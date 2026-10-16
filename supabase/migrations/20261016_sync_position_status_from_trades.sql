-- ==============================================================================
-- Migration: Synchronize transactions.position_status from master 'trades' table
-- File: supabase/migrations/20261016_sync_position_status_from_trades.sql
-- ==============================================================================

-- 1. Asegurar que la columna exista en transactions como campo sincronizado
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS position_status VARCHAR(10) DEFAULT 'Open';

CREATE INDEX IF NOT EXISTS idx_transactions_position_status ON transactions(position_status);

-- 2. Actualizar assign_transaction_data() para que tome el estado desde 'trades'
CREATE OR REPLACE FUNCTION assign_transaction_data()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_trade RECORD;
    v_new_code BIGINT;
BEGIN
    -- Si trade_code ya viene resuelto desde la aplicación:
    IF NEW.trade_code IS NOT NULL AND NEW.trade_code > 0 THEN
        PERFORM setval(
            'trades_trade_code_seq',
            GREATEST((SELECT last_value FROM trades_trade_code_seq), NEW.trade_code),
            true
        );

        -- Buscar el trade maestro para obtener su estado actual
        SELECT trade_code, symbol, unique_key, instrument, status
        INTO v_existing_trade
        FROM trades
        WHERE trade_code = NEW.trade_code
        LIMIT 1;

        IF NOT FOUND THEN
            -- Si es un trade nuevo, insertarlo en 'trades' con status 'Open'
            INSERT INTO trades (
                trade_code,
                symbol,
                unique_key,
                instrument,
                first_buy_date,
                status,
                account_id
            ) VALUES (
                NEW.trade_code,
                COALESCE(NEW.symbol, 'UNKNOWN'),
                COALESCE(NEW.unique_key, NEW.symbol, 'UNKNOWN'),
                COALESCE(NEW.instrument, 'Stock'),
                NEW.date::DATE,
                'Open',
                NEW.account_id
            )
            ON CONFLICT (trade_code) DO NOTHING;

            NEW.position_status := 'Open';
        ELSE
            NEW.symbol := COALESCE(NEW.symbol, v_existing_trade.symbol);
            NEW.unique_key := COALESCE(NEW.unique_key, v_existing_trade.unique_key);
            NEW.instrument := COALESCE(NEW.instrument, v_existing_trade.instrument);
            -- Buscar y sincronizar el estado directamente desde la tabla maestra trades
            NEW.position_status := COALESCE(v_existing_trade.status, 'Open');
        END IF;

        RETURN NEW;
    END IF;

    -- Si NEW.trade_code es NULL: buscar trade activo ('Open') en 'trades' por unique_key
    SELECT trade_code, symbol, unique_key, instrument, status
    INTO v_existing_trade
    FROM trades
    WHERE unique_key = NEW.unique_key
      AND status = 'Open'
      AND (account_id = NEW.account_id OR account_id IS NULL OR NEW.account_id IS NULL)
    ORDER BY first_buy_date DESC NULLS LAST, trade_code DESC
    LIMIT 1;

    IF FOUND THEN
        NEW.trade_code := v_existing_trade.trade_code;
        NEW.symbol := COALESCE(NEW.symbol, v_existing_trade.symbol);
        NEW.unique_key := COALESCE(NEW.unique_key, v_existing_trade.unique_key);
        NEW.instrument := COALESCE(NEW.instrument, v_existing_trade.instrument);
        -- Buscar y sincronizar el estado directamente desde la tabla maestra trades
        NEW.position_status := COALESCE(v_existing_trade.status, 'Open');
    ELSE
        -- Generar nuevo trade_code en 'trades'
        PERFORM setval(
            'trades_trade_code_seq',
            GREATEST(
                (SELECT last_value FROM trades_trade_code_seq),
                COALESCE((SELECT MAX(trade_code) FROM trades), 1),
                COALESCE((SELECT MAX(trade_code) FROM transactions), 1)
            ),
            true
        );
        v_new_code := nextval('trades_trade_code_seq');

        INSERT INTO trades (
            trade_code,
            symbol,
            unique_key,
            instrument,
            first_buy_date,
            status,
            account_id
        ) VALUES (
            v_new_code,
            COALESCE(NEW.symbol, 'UNKNOWN'),
            COALESCE(NEW.unique_key, NEW.symbol, 'UNKNOWN'),
            COALESCE(NEW.instrument, 'Stock'),
            NEW.date::DATE,
            'Open',
            NEW.account_id
        )
        ON CONFLICT (trade_code) DO NOTHING;

        NEW.trade_code := v_new_code;
        NEW.position_status := 'Open';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Vincular el trigger assign_transaction_data en transactions
DROP TRIGGER IF EXISTS trg_assign_transaction_data ON transactions;
CREATE TRIGGER trg_assign_transaction_data
BEFORE INSERT OR UPDATE OF unique_key, symbol, trade_code
ON transactions
FOR EACH ROW
EXECUTE FUNCTION assign_transaction_data();

-- 4. Actualizar sync_trade_metrics_from_transactions para mantener propagado trades.status -> transactions.position_status
CREATE OR REPLACE FUNCTION sync_trade_metrics_from_transactions()
RETURNS TRIGGER AS $$
DECLARE
    v_code BIGINT;
    v_cash_flow NUMERIC(14, 2);
    v_first_buy NUMERIC(14, 2);
    v_net_qty NUMERIC(14, 4);
    v_status VARCHAR(10);
BEGIN
    v_code := COALESCE(NEW.trade_code, OLD.trade_code);
    IF v_code IS NULL OR v_code = 1 THEN
        RETURN NULL;
    END IF;

    -- Calcular sumatoria de cash flow, primera compra y balance neto de cantidad
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
        ),
        COALESCE(
            SUM(
                CASE 
                    WHEN LOWER(action) LIKE '%buy to close%' OR LOWER(action) LIKE '%btc%' THEN -ABS(quantity)
                    WHEN LOWER(action) LIKE '%sell to open%' OR LOWER(action) LIKE '%sto%' THEN ABS(quantity)
                    WHEN LOWER(action) LIKE '%buy to open%' OR LOWER(action) LIKE '%bto%' THEN ABS(quantity)
                    WHEN LOWER(action) LIKE '%sell to close%' OR LOWER(action) LIKE '%stc%' THEN -ABS(quantity)
                    WHEN LOWER(action) LIKE '%exp%' THEN -ABS(quantity)
                    WHEN LOWER(action) LIKE '%sell%' OR LOWER(action) LIKE '%sold%' THEN -ABS(quantity)
                    WHEN LOWER(action) LIKE '%buy%' OR LOWER(action) LIKE '%bot%' OR LOWER(action) LIKE '%bought%' THEN ABS(quantity)
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

    -- 1. Actualizar trade maestro en 'trades'
    UPDATE trades
    SET 
        status = v_status,
        current_quantity = ROUND(COALESCE(v_net_qty, 0)::NUMERIC, 4),
        cash_flow = COALESCE(v_cash_flow, 0),
        realized_pnl = CASE WHEN v_status = 'Closed' THEN COALESCE(v_cash_flow, 0) ELSE NULL END,
        initial_investment = ROUND(COALESCE(v_first_buy, 0)::NUMERIC, 2),
        updated_at = NOW()
    WHERE trade_code = v_code;

    -- 2. Propagar y mantener sincronizado el estado en transactions
    UPDATE transactions
    SET position_status = v_status
    WHERE trade_code = v_code;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_trade_metrics ON transactions;
CREATE TRIGGER trg_sync_trade_metrics
AFTER INSERT OR UPDATE OF amount, price, quantity, action, trade_code OR DELETE
ON transactions
FOR EACH ROW
EXECUTE FUNCTION sync_trade_metrics_from_transactions();

-- 5. Poblar retrospectivamente los registros existentes desde trades.status
UPDATE transactions t
SET position_status = COALESCE(tr.status, 'Open')
FROM trades tr
WHERE t.trade_code = tr.trade_code;
