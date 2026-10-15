-- ==============================================================================
-- Migration: Add Ratchet Stop to Trades Table
-- File: supabase/migrations/20261015_add_ratchet_stop_to_trades.sql
-- ==============================================================================

-- Adds ratchet_stop column to persist the strictly increasing stop floor for
-- New Yearly Highs (52Low) and 100-day-High (100-day-Low) strategies across
-- MK-TOS quote archival cycles.
ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS ratchet_stop NUMERIC(12, 4);

COMMENT ON COLUMN trades.ratchet_stop IS 'Strictly increasing trailing ratchet stop for New Yearly Highs (52Low) and 100-day-High (100-day-Low). Preserves peak stop across quote archival.';
