-- ==============================================================================
-- Migration: Add PnL, Cash Flow, and Initial Investment Columns to Trades Table
-- File: supabase/migrations/20261015_add_pnl_and_cash_flow_to_trades.sql
-- ==============================================================================

-- 1. Agregar columnas a la tabla 'trades'
ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS cash_flow NUMERIC(14, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS initial_investment NUMERIC(14, 2) DEFAULT 0;

-- 2. Índices para acelerar consultas y ordenamientos
CREATE INDEX IF NOT EXISTS idx_trades_realized_pnl ON trades(realized_pnl);
CREATE INDEX IF NOT EXISTS idx_trades_cash_flow ON trades(cash_flow);

-- 3. Documentación de columnas
COMMENT ON COLUMN trades.cash_flow IS 'Suma neta acumulada de importes (amount) de todas las transacciones del trade.';
COMMENT ON COLUMN trades.realized_pnl IS 'Resultado realizado definitivo para trades con status Closed (inmutable tras el cierre).';
COMMENT ON COLUMN trades.initial_investment IS 'Desembolso inicial de la primera compra cronológica del trade.';

-- 4. Backfill inicial a partir de las transacciones históricas existentes
WITH tx_summary AS (
    SELECT 
        trade_code,
        ROUND(SUM(COALESCE(amount, 0))::NUMERIC, 2) AS total_cash_flow,
        COALESCE(
            (
                ARRAY_AGG(
                    COALESCE(
                        NULLIF(ABS(amount), 0),
                        CASE WHEN instrument = 'Option' THEN ABS(price * quantity * 100) ELSE ABS(price * quantity) END
                    )
                    ORDER BY date ASC, created_at ASC
                ) FILTER (WHERE action ILIKE '%buy%' OR action ILIKE '%bot%' OR amount < 0)
            )[1],
            (
                ARRAY_AGG(
                    COALESCE(
                        NULLIF(ABS(amount), 0),
                        CASE WHEN instrument = 'Option' THEN ABS(price * quantity * 100) ELSE ABS(price * quantity) END
                    )
                    ORDER BY date ASC, created_at ASC
                )
            )[1],
            0
        ) AS first_buy_investment
    FROM transactions
    WHERE trade_code IS NOT NULL 
      AND trade_code != 1
    GROUP BY trade_code
)
UPDATE trades t
SET 
    cash_flow = s.total_cash_flow,
    realized_pnl = CASE WHEN t.status = 'Closed' THEN s.total_cash_flow ELSE NULL END,
    initial_investment = ROUND(COALESCE(s.first_buy_investment, 0)::NUMERIC, 2)
FROM tx_summary s
WHERE t.trade_code = s.trade_code;

-- 5. Función trigger para mantener sincronizados los valores ante cambios en transacciones
CREATE OR REPLACE FUNCTION sync_trade_metrics_from_transactions()
RETURNS TRIGGER AS $$
DECLARE
    v_code BIGINT;
    v_cash_flow NUMERIC(14, 2);
    v_first_buy NUMERIC(14, 2);
    v_status VARCHAR(10);
BEGIN
    v_code := COALESCE(NEW.trade_code, OLD.trade_code);
    IF v_code IS NULL OR v_code = 1 THEN
        RETURN NULL;
    END IF;

    -- Obtener estado actual del trade
    SELECT status INTO v_status FROM trades WHERE trade_code = v_code;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Calcular sumatoria de cash flow y desembolso inicial
    SELECT 
        ROUND(SUM(COALESCE(amount, 0))::NUMERIC, 2),
        COALESCE(
            (
                ARRAY_AGG(
                    COALESCE(
                        NULLIF(ABS(amount), 0),
                        CASE WHEN instrument = 'Option' THEN ABS(price * quantity * 100) ELSE ABS(price * quantity) END
                    )
                    ORDER BY date ASC, created_at ASC
                ) FILTER (WHERE action ILIKE '%buy%' OR action ILIKE '%bot%' OR amount < 0)
            )[1],
            (
                ARRAY_AGG(
                    COALESCE(
                        NULLIF(ABS(amount), 0),
                        CASE WHEN instrument = 'Option' THEN ABS(price * quantity * 100) ELSE ABS(price * quantity) END
                    )
                    ORDER BY date ASC, created_at ASC
                )
            )[1],
            0
        )
    INTO v_cash_flow, v_first_buy
    FROM transactions
    WHERE trade_code = v_code;

    -- Actualizar el trade
    UPDATE trades
    SET 
        cash_flow = COALESCE(v_cash_flow, 0),
        realized_pnl = CASE WHEN v_status = 'Closed' THEN COALESCE(v_cash_flow, 0) ELSE NULL END,
        initial_investment = ROUND(COALESCE(v_first_buy, 0)::NUMERIC, 2),
        updated_at = NOW()
    WHERE trade_code = v_code;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear el trigger en la tabla transactions
DROP TRIGGER IF EXISTS trg_sync_trade_metrics ON transactions;
CREATE TRIGGER trg_sync_trade_metrics
AFTER INSERT OR UPDATE OF amount, price, quantity, action, trade_code OR DELETE
ON transactions
FOR EACH ROW
EXECUTE FUNCTION sync_trade_metrics_from_transactions();
