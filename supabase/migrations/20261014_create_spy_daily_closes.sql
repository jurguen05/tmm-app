-- ==============================================================================
-- Migration: Create spy_daily_closes (Weekend Trader market filter history)
-- File: supabase/migrations/20261014_create_spy_daily_closes.sql
--
-- Purpose:
--   Persist SPY Last vs SMA 10W for every MK-TOS quote date, independently of
--   the MK-TOS files. This keeps the Weekend Trader green/red ribbon history
--   available even after MK-TOS files are archived or deleted.
--
--   One row per trading date (not only Fridays) so the weekly-close detection
--   (Friday, or Thursday when Friday was a market holiday) keeps working with
--   the same rule used by esCierreSemanal() in lib/formatters.ts.
-- ==============================================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS spy_daily_closes (
    quote_date      DATE PRIMARY KEY,
    spy_last        NUMERIC(12, 4) NOT NULL CHECK (spy_last > 0),
    spy_sma_10w     NUMERIC(12, 4) NOT NULL CHECK (spy_sma_10w > 0),
    is_red          BOOLEAN GENERATED ALWAYS AS (spy_last <= spy_sma_10w) STORED,
    file_upload_id  UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_spy_daily_closes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_spy_daily_closes_updated_at ON spy_daily_closes;
CREATE TRIGGER trg_spy_daily_closes_updated_at
BEFORE UPDATE ON spy_daily_closes
FOR EACH ROW
EXECUTE FUNCTION update_spy_daily_closes_updated_at();

-- 3. Row Level Security (same policy model as trades)
ALTER TABLE spy_daily_closes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para usuarios autenticados" ON spy_daily_closes;
CREATE POLICY "Permitir select para usuarios autenticados"
ON spy_daily_closes FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir insert para usuarios autenticados" ON spy_daily_closes;
CREATE POLICY "Permitir insert para usuarios autenticados"
ON spy_daily_closes FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir update para usuarios autenticados" ON spy_daily_closes;
CREATE POLICY "Permitir update para usuarios autenticados"
ON spy_daily_closes FOR UPDATE TO authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir delete para usuarios autenticados" ON spy_daily_closes;
CREATE POLICY "Permitir delete para usuarios autenticados"
ON spy_daily_closes FOR DELETE TO authenticated
USING (true);

-- 4. Backfill from every MK-TOS file already loaded (archived ones included,
--    since the goal is to keep the full history). If the same date appears in
--    several files, the most recently uploaded file wins.
INSERT INTO spy_daily_closes (quote_date, spy_last, spy_sma_10w, file_upload_id)
SELECT DISTINCT ON (q.quote_date)
    q.quote_date::DATE,
    q.last_price,
    q.sma_10w,
    q.file_upload_id
FROM mk_tos_quotes q
JOIN file_uploads fu ON fu.id = q.file_upload_id
WHERE UPPER(TRIM(q.symbol)) = 'SPY'
  AND q.last_price > 0
  AND q.sma_10w > 0
ORDER BY q.quote_date, fu.created_at DESC
ON CONFLICT (quote_date) DO UPDATE
SET spy_last       = EXCLUDED.spy_last,
    spy_sma_10w    = EXCLUDED.spy_sma_10w,
    file_upload_id = EXCLUDED.file_upload_id;
