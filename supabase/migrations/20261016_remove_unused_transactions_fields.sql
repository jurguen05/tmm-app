-- ==============================================================================
-- Migration: Remove Unused Columns from Transactions and Update Trigger
-- File: supabase/migrations/20261016_remove_unused_transactions_fields.sql
-- ==============================================================================

-- 1. Eliminar índice dependiente si existe
DROP INDEX IF EXISTS idx_transactions_position_status;

-- 2. Eliminar columnas que migraron a la tabla maestra 'trades' o están obsoletas
ALTER TABLE transactions 
  DROP COLUMN IF EXISTS codigo,
  DROP COLUMN IF EXISTS position_status,
  DROP COLUMN IF EXISTS strategy_id,
  DROP COLUMN IF EXISTS stock_entry_price;

-- 3. Actualizar la función del trigger assign_transaction_data()
--    para que 'trades' sea la única autoridad y no intente escribir en las columnas removidas.
CREATE OR REPLACE FUNCTION assign_transaction_data()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_trade RECORD;
    v_new_code BIGINT;
BEGIN
    -- Si trade_code ya fue resuelto por la capa de aplicación:
    IF NEW.trade_code IS NOT NULL AND NEW.trade_code > 0 THEN
        PERFORM setval(
            'trades_trade_code_seq',
            GREATEST((SELECT last_value FROM trades_trade_code_seq), NEW.trade_code),
            true
        );

        -- Asegurar que el trade exista en 'trades'
        SELECT trade_code, symbol, unique_key, instrument, status
        INTO v_existing_trade
        FROM trades
        WHERE trade_code = NEW.trade_code
        LIMIT 1;

        IF NOT FOUND THEN
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
        ELSE
            NEW.symbol := COALESCE(NEW.symbol, v_existing_trade.symbol);
            NEW.unique_key := COALESCE(NEW.unique_key, v_existing_trade.unique_key);
            NEW.instrument := COALESCE(NEW.instrument, v_existing_trade.instrument);
        END IF;

        RETURN NEW;
    END IF;

    -- Si NEW.trade_code ES NULL: buscar trade activo ('Open') en 'trades' por unique_key
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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Asegurar que el trigger esté vinculado en transactions
DROP TRIGGER IF EXISTS trg_assign_transaction_data ON transactions;
CREATE TRIGGER trg_assign_transaction_data
BEFORE INSERT OR UPDATE OF unique_key, symbol, trade_code
ON transactions
FOR EACH ROW
EXECUTE FUNCTION assign_transaction_data();
