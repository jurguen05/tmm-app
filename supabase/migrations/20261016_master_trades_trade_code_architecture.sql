-- ==============================================================================
-- Migration: Master-Detail Architecture (Trades generates trade_code & unique_key)
-- File: supabase/migrations/20261016_master_trades_trade_code_architecture.sql
-- ==============================================================================

-- 1. Ensure 'instrument' column exists in master 'trades' table
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS instrument VARCHAR(10) NOT NULL DEFAULT 'Stock';

-- Backfill 'instrument' in 'trades' from 'transactions'
UPDATE trades tr
SET instrument = sub.instrument
FROM (
    SELECT DISTINCT ON (trade_code)
        trade_code,
        COALESCE(instrument, 'Stock') AS instrument
    FROM transactions
    WHERE trade_code IS NOT NULL
    ORDER BY trade_code, date ASC
) sub
WHERE tr.trade_code = sub.trade_code;

-- 2. Backfill any missing trade_code from 'transactions' into 'trades' before adding FK
INSERT INTO trades (
    trade_code,
    symbol,
    unique_key,
    instrument,
    strategy_id,
    stock_entry_price,
    first_buy_date,
    status,
    weekend_trader_flag,
    account_id
)
SELECT 
    t.trade_code,
    COALESCE((ARRAY_AGG(t.symbol ORDER BY t.date ASC))[1], 'UNKNOWN') AS symbol,
    COALESCE((ARRAY_AGG(t.unique_key ORDER BY t.date ASC))[1], (ARRAY_AGG(t.symbol ORDER BY t.date ASC))[1], 'UNKNOWN') AS unique_key,
    COALESCE((ARRAY_AGG(t.instrument ORDER BY t.date ASC))[1], 'Stock') AS instrument,
    (ARRAY_AGG(t.strategy_id ORDER BY t.date DESC) FILTER (WHERE t.strategy_id IS NOT NULL))[1] AS strategy_id,
    COALESCE(
        (ARRAY_AGG(t.stock_entry_price ORDER BY t.date ASC) FILTER (WHERE t.stock_entry_price IS NOT NULL AND (t.action ILIKE '%buy%' OR t.amount < 0)))[1],
        (ARRAY_AGG(t.stock_entry_price ORDER BY t.date ASC) FILTER (WHERE t.stock_entry_price IS NOT NULL))[1],
        (ARRAY_AGG(t.price ORDER BY t.date ASC) FILTER (WHERE t.instrument = 'Stock' AND (t.action ILIKE '%buy%' OR t.amount < 0)))[1],
        0
    ) AS stock_entry_price,
    COALESCE(
        MIN(t.date) FILTER (WHERE t.action ILIKE '%buy%' OR t.amount < 0),
        MIN(t.date)
    )::DATE AS first_buy_date,
    'Open' AS status,
    FALSE AS weekend_trader_flag,
    (ARRAY_AGG(t.account_id))[1] AS account_id
FROM transactions t
WHERE t.trade_code IS NOT NULL AND t.trade_code > 0
GROUP BY t.trade_code
ON CONFLICT (trade_code) DO NOTHING;

-- 3. Create sequence for trade_code in 'trades' and sync with current max trade_code
CREATE SEQUENCE IF NOT EXISTS trades_trade_code_seq;

SELECT setval(
    'trades_trade_code_seq',
    GREATEST(
        COALESCE((SELECT MAX(trade_code) FROM trades), 1),
        COALESCE((SELECT MAX(trade_code) FROM transactions), 1)
    ),
    true
);

ALTER TABLE trades
ALTER COLUMN trade_code SET DEFAULT nextval('trades_trade_code_seq');

-- 4. Index for fast lookup of Open trades by unique_key and account_id
CREATE INDEX IF NOT EXISTS idx_trades_open_unique_key
ON trades (unique_key, account_id)
WHERE status = 'Open';

-- 5. Add Foreign Key from transactions(trade_code) -> trades(trade_code)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_transactions_trade_code'
          AND table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT fk_transactions_trade_code
        FOREIGN KEY (trade_code)
        REFERENCES trades(trade_code)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Update trigger function on 'trades' so closing/reopening a trade always keeps
--    max_stock_price, max_stock_price_date, weekend_trader_flag, and realized_pnl consistent
CREATE OR REPLACE FUNCTION clean_closed_trade_max_prices()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Closed' THEN
        NEW.max_stock_price := NULL;
        NEW.max_stock_price_date := NULL;
        NEW.weekend_trader_flag := FALSE;
        NEW.realized_pnl := COALESCE(NEW.cash_flow, NEW.realized_pnl, 0);
    ELSIF NEW.status = 'Open' THEN
        NEW.realized_pnl := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_closed_trade_max_prices ON trades;
CREATE TRIGGER trg_clean_closed_trade_max_prices
BEFORE INSERT OR UPDATE OF status, cash_flow, max_stock_price, max_stock_price_date
ON trades
FOR EACH ROW
EXECUTE FUNCTION clean_closed_trade_max_prices();

-- 7. Update trigger function assign_transaction_data() so 'trades' is the master authority for trade_code
CREATE OR REPLACE FUNCTION assign_transaction_data()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_trade RECORD;
    v_new_code BIGINT;
BEGIN
    -- If trade_code was already resolved by the application layer from 'trades', keep sequence synced
    IF NEW.trade_code IS NOT NULL AND NEW.trade_code > 0 THEN
        PERFORM setval(
            'trades_trade_code_seq',
            GREATEST((SELECT last_value FROM trades_trade_code_seq), NEW.trade_code),
            true
        );

        -- Ensure parent trade exists in 'trades'
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

    -- When NEW.trade_code IS NULL: look up an active ('Open') trade in master table 'trades' by unique_key
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
        -- Generate new trade_code in 'trades' first
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
$$ LANGUAGE plpgsql;

-- 8. Update sync_trade_metrics_from_transactions() to read master 'instrument' and 'status' from 'trades'
CREATE OR REPLACE FUNCTION sync_trade_metrics_from_transactions()
RETURNS TRIGGER AS $$
DECLARE
    v_code BIGINT;
    v_cash_flow NUMERIC(14, 2);
    v_first_buy NUMERIC(14, 2);
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

    -- Calcular sumatoria de cash flow y desembolso inicial usando el instrumento del trade maestro como respaldo
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
        )
    INTO v_cash_flow, v_first_buy
    FROM transactions
    WHERE trade_code = v_code;

    -- Actualizar el trade maestro
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
