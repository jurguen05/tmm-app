-- ==============================================================================
-- Migration: Backfill Max Stock Price & Date exclusively for OPEN trades:
--   1. '20% Flipper' (highest last_price on all market days since first_buy_date)
--   2. 'Weekend Trader' (highest last_price EXCLUSIVELY on Fridays since first_buy_date)
--
-- Rule: When a trade is Closed, max_stock_price and max_stock_price_date MUST BE NULL.
-- File: supabase/migrations/20261013_backfill_max_stock_price.sql
-- ==============================================================================

-- 1. Ensure columns and index exist
ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS max_stock_price NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS max_stock_price_date DATE;

CREATE INDEX IF NOT EXISTS idx_trades_max_stock_price_date ON trades(max_stock_price_date);

-- 2. Trigger en DB para forzar que cualquier trade 'Closed' tenga siempre max_stock_price = NULL y max_stock_price_date = NULL
CREATE OR REPLACE FUNCTION clean_closed_trade_max_prices()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Closed' THEN
    NEW.max_stock_price := NULL;
    NEW.max_stock_price_date := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_closed_trade_max_prices ON trades;
CREATE TRIGGER trg_clean_closed_trade_max_prices
BEFORE INSERT OR UPDATE OF status, max_stock_price, max_stock_price_date
ON trades
FOR EACH ROW
EXECUTE FUNCTION clean_closed_trade_max_prices();

-- 3. Limpiar valores para trades que ya estén 'Closed' o pertenezcan a otras estrategias
UPDATE trades t
SET 
  max_stock_price = NULL,
  max_stock_price_date = NULL
FROM strategies s
WHERE (t.strategy_id = s.id AND NOT (s.name ILIKE '%flipper%' OR s.name ILIKE '%weekend%' OR t.weekend_trader_flag = true))
   OR t.status = 'Closed';

-- 4. Poblado para 20% Flipper (EXCLUSIVAMENTE trades Open)
WITH quotes_flipper AS (
  SELECT 
    t.trade_code,
    q.last_price,
    q.quote_date,
    ROW_NUMBER() OVER (
      PARTITION BY t.trade_code 
      ORDER BY q.last_price DESC, q.quote_date DESC
    ) AS rn
  FROM trades t
  JOIN strategies s ON t.strategy_id = s.id
  JOIN mk_tos_quotes q ON q.symbol = t.symbol
  JOIN file_uploads fu ON q.file_upload_id = fu.id
  WHERE fu.is_archived = false
    AND t.status = 'Open'
    AND (s.name ILIKE '%flipper%' OR s.name ILIKE '%20%')
    AND q.quote_date >= COALESCE(t.first_buy_date, '1970-01-01')
)
UPDATE trades t
SET 
  max_stock_price = qf.last_price,
  max_stock_price_date = qf.quote_date
FROM quotes_flipper qf
WHERE t.trade_code = qf.trade_code
  AND t.status = 'Open'
  AND qf.rn = 1;

-- 4b. 20% Flipper: Si el precio de entrada inicial (stock_entry_price) fue el más alto (solo Open)
UPDATE trades t
SET 
  max_stock_price = t.stock_entry_price,
  max_stock_price_date = t.first_buy_date
FROM strategies s
WHERE t.strategy_id = s.id
  AND t.status = 'Open'
  AND (s.name ILIKE '%flipper%' OR s.name ILIKE '%20%')
  AND t.stock_entry_price IS NOT NULL 
  AND t.stock_entry_price > 0
  AND (t.max_stock_price IS NULL OR t.stock_entry_price > t.max_stock_price);

-- 5. Poblado para Weekend Trader (EXCLUSIVAMENTE trades Open y cotizaciones en viernes)
WITH quotes_weekend AS (
  SELECT 
    t.trade_code,
    q.last_price,
    q.quote_date,
    ROW_NUMBER() OVER (
      PARTITION BY t.trade_code 
      ORDER BY q.last_price DESC, q.quote_date DESC
    ) AS rn
  FROM trades t
  LEFT JOIN strategies s ON t.strategy_id = s.id
  JOIN mk_tos_quotes q ON q.symbol = t.symbol
  JOIN file_uploads fu ON q.file_upload_id = fu.id
  WHERE fu.is_archived = false
    AND t.status = 'Open'
    AND (s.name ILIKE '%weekend%' OR t.weekend_trader_flag = true)
    AND EXTRACT(DOW FROM q.quote_date) = 5
    AND q.quote_date >= COALESCE(t.first_buy_date, '1970-01-01')
)
UPDATE trades t
SET 
  max_stock_price = qw.last_price,
  max_stock_price_date = qw.quote_date
FROM quotes_weekend qw
WHERE t.trade_code = qw.trade_code
  AND t.status = 'Open'
  AND qw.rn = 1;

-- 5b. Weekend Trader: Si first_buy_date cayó en viernes y stock_entry_price fue el más alto (solo Open)
UPDATE trades t
SET 
  max_stock_price = t.stock_entry_price,
  max_stock_price_date = t.first_buy_date
FROM strategies s
WHERE ((t.strategy_id = s.id AND s.name ILIKE '%weekend%') OR t.weekend_trader_flag = true)
  AND t.status = 'Open'
  AND t.first_buy_date IS NOT NULL
  AND EXTRACT(DOW FROM t.first_buy_date) = 5
  AND t.stock_entry_price IS NOT NULL 
  AND t.stock_entry_price > 0
  AND (t.max_stock_price IS NULL OR t.stock_entry_price > t.max_stock_price);
