-- ==============================================================================
-- Migration: Backfill weekend_trader_flag = true for OPEN Weekend Trader trades bought before 2026-07-24
-- Rule: Closed trades MUST ALWAYS have weekend_trader_flag = FALSE.
-- File: supabase/migrations/20261013_backfill_weekend_trader_flag_cutoff.sql
-- ==============================================================================

-- 1. Forzar que cualquier trade Closed tenga el flag en FALSE
UPDATE trades
SET weekend_trader_flag = false
WHERE status = 'Closed';

-- 2. Activar el flag exclusivamente para trades OPEN comprados antes del 2026-07-24
UPDATE trades t
SET weekend_trader_flag = true
FROM strategies s
WHERE t.strategy_id = s.id
  AND s.name ILIKE '%weekend%'
  AND t.first_buy_date < '2026-07-24'
  AND t.status = 'Open';

UPDATE trades
SET weekend_trader_flag = true
WHERE first_buy_date < '2026-07-24'
  AND status = 'Open'
  AND (
    strategy_id IN (SELECT id FROM strategies WHERE name ILIKE '%weekend%')
    OR trade_code IN (
      SELECT DISTINCT t.trade_code FROM transactions t
      JOIN strategies s ON t.strategy_id = s.id
      WHERE s.name ILIKE '%weekend%'
    )
  );
