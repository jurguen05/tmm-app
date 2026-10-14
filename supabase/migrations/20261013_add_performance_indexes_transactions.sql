-- ==============================================================================
-- Migration: Add Performance Indexes to Transactions Table
-- File: supabase/migrations/20261013_add_performance_indexes_transactions.sql
-- ==============================================================================

-- 1. Index for fast date/created_at sorting and pagination on transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_date_created ON transactions(date DESC, created_at DESC);

-- 2. Index for fast trade_code lookup and joining with trades
CREATE INDEX IF NOT EXISTS idx_transactions_trade_code ON transactions(trade_code);

-- 3. Index for fast file_upload_id lookup and deletion
CREATE INDEX IF NOT EXISTS idx_transactions_file_upload_id ON transactions(file_upload_id);

-- 4. Index for symbol search/filtering
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions(symbol);

-- 5. Index for status filtering (Open / Closed)
CREATE INDEX IF NOT EXISTS idx_transactions_position_status ON transactions(position_status);
