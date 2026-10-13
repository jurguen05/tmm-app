-- ==============================================================================
-- Migration: Add Max Stock Price & Date to Trades
-- File: supabase/migrations/20261013_add_max_stock_price_to_trades.sql
-- ==============================================================================

ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS max_stock_price NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS max_stock_price_date DATE;

-- Performance index for queries based on peak date
CREATE INDEX IF NOT EXISTS idx_trades_max_stock_price_date ON trades(max_stock_price_date);
