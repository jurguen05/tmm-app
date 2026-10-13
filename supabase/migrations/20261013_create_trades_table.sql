-- ==============================================================================
-- Migration: Create Trades Table and Backfill from Existing Transactions
-- File: supabase/migrations/20261013_create_trades_table.sql
-- ==============================================================================

-- 1. Create table 'trades'
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_code BIGINT NOT NULL UNIQUE,
    symbol VARCHAR(20) NOT NULL,
    unique_key VARCHAR(100) NOT NULL,
    strategy_id BIGINT REFERENCES strategies(id) ON DELETE SET NULL,
    stock_entry_price NUMERIC(12, 4),
    first_buy_date DATE,
    status VARCHAR(10) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
    weekend_trader_flag BOOLEAN NOT NULL DEFAULT FALSE,
    account_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_trades_trade_code ON trades(trade_code);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_unique_key ON trades(unique_key);

-- 3. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_trades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trades_updated_at ON trades;
CREATE TRIGGER trg_trades_updated_at
BEFORE UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION update_trades_updated_at();

-- 4. Enable Row Level Security (RLS) and policies
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para usuarios autenticados" ON trades;
CREATE POLICY "Permitir select para usuarios autenticados"
ON trades FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir insert para usuarios autenticados" ON trades;
CREATE POLICY "Permitir insert para usuarios autenticados"
ON trades FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir update para usuarios autenticados" ON trades;
CREATE POLICY "Permitir update para usuarios autenticados"
ON trades FOR UPDATE TO authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir delete para usuarios autenticados" ON trades;
CREATE POLICY "Permitir delete para usuarios autenticados"
ON trades FOR DELETE TO authenticated
USING (true);

-- 5. Backfill existing trades from transactions
-- Populates the master 'trades' table using the earliest buy transaction for each trade_code
INSERT INTO trades (
    trade_code,
    symbol,
    unique_key,
    strategy_id,
    stock_entry_price,
    first_buy_date,
    status,
    weekend_trader_flag,
    account_id
)
SELECT 
    t.trade_code,
    t.symbol,
    (ARRAY_AGG(t.unique_key ORDER BY t.date ASC))[1] AS unique_key,
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
    CASE 
        WHEN BOOL_OR(LOWER(t.position_status) = 'open') THEN 'Open'
        ELSE 'Closed'
    END AS status,
    FALSE AS weekend_trader_flag,
    (ARRAY_AGG(t.account_id))[1] AS account_id
FROM transactions t
WHERE t.trade_code IS NOT NULL AND t.trade_code > 0
GROUP BY t.trade_code, t.symbol
ON CONFLICT (trade_code) DO NOTHING;
