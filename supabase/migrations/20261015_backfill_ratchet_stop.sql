-- ==============================================================================
-- Migration: Backfill Ratchet Stop exclusively for OPEN trades:
--   1. 'New Yearly Highs' (highest low_52 since first_buy_date)
--   2. '100-day-High' (highest low_100_day since first_buy_date)
--
-- Rule: When a trade is Closed, ratchet_stop is set to NULL.
-- File: supabase/migrations/20261015_backfill_ratchet_stop.sql
-- ==============================================================================

-- 1. Ensure column exists
ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS ratchet_stop NUMERIC(12, 4);

-- 2. Trigger para limpiar ratchet_stop al cerrarse el trade (igual que max_stock_price)
CREATE OR REPLACE FUNCTION clean_closed_trade_ratchet_stop()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Closed' THEN
    NEW.ratchet_stop := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_closed_trade_ratchet_stop ON trades;
CREATE TRIGGER trg_clean_closed_trade_ratchet_stop
BEFORE INSERT OR UPDATE OF status, ratchet_stop
ON trades
FOR EACH ROW
EXECUTE FUNCTION clean_closed_trade_ratchet_stop();

-- 3. Backfill para New Yearly Highs (EXCLUSIVAMENTE trades Open)
WITH quotes_nyh AS (
  SELECT 
    t.trade_code,
    q.low_52,
    ROW_NUMBER() OVER (
      PARTITION BY t.trade_code 
      ORDER BY q.low_52 DESC, q.quote_date DESC
    ) AS rn
  FROM trades t
  JOIN strategies s ON t.strategy_id = s.id
  JOIN mk_tos_quotes q ON q.symbol = t.symbol
  JOIN file_uploads fu ON q.file_upload_id = fu.id
  WHERE fu.is_archived = false
    AND t.status = 'Open'
    AND (s.name ILIKE '%new%yearly%' OR s.name ILIKE '%yearly%high%')
    AND q.quote_date >= COALESCE(t.first_buy_date, '1970-01-01')
    AND q.low_52 IS NOT NULL AND q.low_52 > 0
)
UPDATE trades t
SET ratchet_stop = qn.low_52
FROM quotes_nyh qn
WHERE t.trade_code = qn.trade_code
  AND t.status = 'Open'
  AND qn.rn = 1;

-- 4. Backfill para 100-day-High (EXCLUSIVAMENTE trades Open)
WITH quotes_100day AS (
  SELECT 
    t.trade_code,
    q.low_100_day,
    ROW_NUMBER() OVER (
      PARTITION BY t.trade_code 
      ORDER BY q.low_100_day DESC, q.quote_date DESC
    ) AS rn
  FROM trades t
  JOIN strategies s ON t.strategy_id = s.id
  JOIN mk_tos_quotes q ON q.symbol = t.symbol
  JOIN file_uploads fu ON q.file_upload_id = fu.id
  WHERE fu.is_archived = false
    AND t.status = 'Open'
    AND (s.name ILIKE '%100%day%' OR s.name ILIKE '%100-day%')
    AND q.quote_date >= COALESCE(t.first_buy_date, '1970-01-01')
    AND q.low_100_day IS NOT NULL AND q.low_100_day > 0
)
UPDATE trades t
SET ratchet_stop = q100.low_100_day
FROM quotes_100day q100
WHERE t.trade_code = q100.trade_code
  AND t.status = 'Open'
  AND q100.rn = 1;
