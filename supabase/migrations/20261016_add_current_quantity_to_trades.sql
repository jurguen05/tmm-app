-- ==============================================================================
-- Migration: Add current_quantity to Trades Table and Update Sync Trigger
-- File: supabase/migrations/20261016_add_current_quantity_to_trades.sql
-- ==============================================================================

-- 1. Agregar columna 'current_quantity' a la tabla maestra 'trades'
ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS current_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0;

-- 2. Índice para acelerar filtros de trades abiertos con posición activa
CREATE INDEX IF NOT EXISTS idx_trades_current_quantity ON trades(current_quantity);

-- 3. Documentación de columna
COMMENT ON COLUMN trades.current_quantity IS 'Saldo neto acumulado de cantidades (shares/contratos) de las transacciones del trade. Es 0 si el trade está cerrado.';

-- 4. Backfill inicial: Actualiza current_quantity Y el status ('Open' o 'Closed') en todos los trades históricos
WITH tx_qty AS (
    SELECT 
        trade_code,
        ROUND(
            SUM(
                CASE 
                    -- 1. Buy to Close (-)
                    WHEN LOWER(action) LIKE '%buy to close%' OR LOWER(action) LIKE '%btc%' THEN -ABS(quantity)
                    -- 2. Sell to Open (+)
                    WHEN LOWER(action) LIKE '%sell to open%' OR LOWER(action) LIKE '%sto%' THEN ABS(quantity)
                    -- 3. Buy to Open (+)
                    WHEN LOWER(action) LIKE '%buy to open%' OR LOWER(action) LIKE '%bto%' THEN ABS(quantity)
                    -- 4. Sell to Close (-)
                    WHEN LOWER(action) LIKE '%sell to close%' OR LOWER(action) LIKE '%stc%' THEN -ABS(quantity)
                    -- 5. Expired (-)
                    WHEN LOWER(action) LIKE '%exp%' THEN -ABS(quantity)
                    -- 6. Sell genérico (-)
                    WHEN LOWER(action) LIKE '%sell%' OR LOWER(action) LIKE '%sold%' THEN -ABS(quantity)
                    -- 7. Buy genérico (+)
                    WHEN LOWER(action) LIKE '%buy%' OR LOWER(action) LIKE '%bot%' OR LOWER(action) LIKE '%bought%' THEN ABS(quantity)
                    -- 8. Fallback por signo de cantidad
                    WHEN quantity < 0 THEN -ABS(quantity)
                    WHEN quantity > 0 THEN ABS(quantity)
                    ELSE 0
                END
            )::NUMERIC, 
            4
        ) AS net_qty
    FROM transactions
    WHERE trade_code IS NOT NULL 
      AND trade_code != 1
    GROUP BY trade_code
)
UPDATE trades t
SET 
    status = CASE 
        WHEN COALESCE(q.net_qty, 0) <= 0.0001 THEN 'Closed' 
        ELSE 'Open' 
    END,
    current_quantity = CASE 
        WHEN COALESCE(q.net_qty, 0) <= 0.0001 THEN 0 
        ELSE GREATEST(0, q.net_qty) 
    END
FROM tx_qty q
WHERE t.trade_code = q.trade_code;

-- 5. Actualizar la función trigger para mantener sincronizados current_quantity, status, cash_flow e initial_investment
CREATE OR REPLACE FUNCTION sync_trade_metrics_from_transactions()
RETURNS TRIGGER AS $$
DECLARE
    v_code BIGINT;
    v_cash_flow NUMERIC(14, 2);
    v_first_buy NUMERIC(14, 2);
    v_net_qty NUMERIC(12, 4);
    v_status VARCHAR(10);
    v_instrument VARCHAR(10);
BEGIN
    v_code := COALESCE(NEW.trade_code, OLD.trade_code);
    IF v_code IS NULL OR v_code = 1 THEN
        RETURN NULL;
    END IF;

    -- Obtener estado e instrumento actual del trade maestro
    SELECT status, COALESCE(instrument, 'Stock')
    INTO v_status, v_instrument
    FROM trades
    WHERE trade_code = v_code;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Calcular sumatoria de cash flow, desembolso inicial y balance neto de cantidades según reglas de Action
    SELECT 
        ROUND(SUM(COALESCE(amount, 0))::NUMERIC, 2),
        COALESCE(
            (
                ARRAY_AGG(
                    COALESCE(
                        NULLIF(ABS(amount), 0),
                        CASE WHEN COALESCE(instrument, v_instrument) = 'Option' THEN ABS(price * quantity * 100) ELSE ABS(price * quantity) END
                    )
                    ORDER BY date ASC, created_at ASC
                ) FILTER (WHERE action ILIKE '%buy%' OR action ILIKE '%bot%' OR amount < 0)
            )[1],
            (
                ARRAY_AGG(
                    COALESCE(
                        NULLIF(ABS(amount), 0),
                        CASE WHEN COALESCE(instrument, v_instrument) = 'Option' THEN ABS(price * quantity * 100) ELSE ABS(price * quantity) END
                    )
                    ORDER BY date ASC, created_at ASC
                )
            )[1],
            0
        ),
        COALESCE(
            SUM(
                CASE 
                    -- 1. Buy to Close (-)
                    WHEN LOWER(action) LIKE '%buy to close%' OR LOWER(action) LIKE '%btc%' THEN -ABS(quantity)
                    -- 2. Sell to Open (+)
                    WHEN LOWER(action) LIKE '%sell to open%' OR LOWER(action) LIKE '%sto%' THEN ABS(quantity)
                    -- 3. Buy to Open (+)
                    WHEN LOWER(action) LIKE '%buy to open%' OR LOWER(action) LIKE '%bto%' THEN ABS(quantity)
                    -- 4. Sell to Close (-)
                    WHEN LOWER(action) LIKE '%sell to close%' OR LOWER(action) LIKE '%stc%' THEN -ABS(quantity)
                    -- 5. Expired (-)
                    WHEN LOWER(action) LIKE '%exp%' THEN -ABS(quantity)
                    -- 6. Sell genérico (-)
                    WHEN LOWER(action) LIKE '%sell%' OR LOWER(action) LIKE '%sold%' THEN -ABS(quantity)
                    -- 7. Buy genérico (+)
                    WHEN LOWER(action) LIKE '%buy%' OR LOWER(action) LIKE '%bot%' OR LOWER(action) LIKE '%bought%' THEN ABS(quantity)
                    -- 8. Fallback por signo de cantidad
                    WHEN quantity < 0 THEN -ABS(quantity)
                    WHEN quantity > 0 THEN ABS(quantity)
                    ELSE 0
                END
            ),
            0
        )
    INTO v_cash_flow, v_first_buy, v_net_qty
    FROM transactions
    WHERE trade_code = v_code;

    -- Determinar estado consistente y cantidad actual
    IF v_net_qty IS NULL OR ABS(v_net_qty) <= 0.0001 THEN
        v_status := 'Closed';
        v_net_qty := 0;
    ELSE
        v_status := 'Open';
        v_net_qty := GREATEST(0, v_net_qty);
    END IF;

    -- Actualizar el trade maestro
    UPDATE trades
    SET 
        status = v_status,
        current_quantity = ROUND(COALESCE(v_net_qty, 0)::NUMERIC, 4),
        cash_flow = COALESCE(v_cash_flow, 0),
        realized_pnl = CASE WHEN v_status = 'Closed' THEN COALESCE(v_cash_flow, 0) ELSE NULL END,
        initial_investment = ROUND(COALESCE(v_first_buy, 0)::NUMERIC, 2),
        updated_at = NOW()
    WHERE trade_code = v_code;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Asegurar que el trigger exista en 'transactions'
DROP TRIGGER IF EXISTS trg_sync_trade_metrics ON transactions;
CREATE TRIGGER trg_sync_trade_metrics
AFTER INSERT OR UPDATE OF amount, price, quantity, action, trade_code OR DELETE
ON transactions
FOR EACH ROW
EXECUTE FUNCTION sync_trade_metrics_from_transactions();
