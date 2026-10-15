-- ==============================================================================
-- Migration: Add Exit Metrics & Stop Fields to Trades Table
-- File: supabase/migrations/20261015_add_exit_fields_to_trades.sql
-- ==============================================================================

-- 1. Agregar columnas para registrar métricas de salida al cerrarse el trade
ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS ratchet_stop NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS exit_stop NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS exit_price NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS exit_signal NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS closed_date DATE;

-- 2. Índices para consultas de trades cerrados
CREATE INDEX IF NOT EXISTS idx_trades_closed_date ON trades(closed_date);

-- 3. Documentación de columnas
COMMENT ON COLUMN trades.ratchet_stop IS 'Piso de stop trinquete trailing estrictamente creciente para New Yearly Highs y 100-day-High.';
COMMENT ON COLUMN trades.exit_stop IS 'Valor definitivo del stop al momento de cerrarse la operación.';
COMMENT ON COLUMN trades.exit_price IS 'Precio Last de mercado de la acción al momento de cerrarse la operación.';
COMMENT ON COLUMN trades.exit_signal IS 'Valor numérico de la señal técnica al momento del cierre (especialmente MAC_STOP o TrendPilot_STOP).';
COMMENT ON COLUMN trades.closed_date IS 'Fecha en que se cerró la operación (fecha de última venta o cierre manual).';
