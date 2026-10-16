-- ==============================================================================
-- Migration: Remove Competing Trigger 'assign_transaction_data'
-- File: supabase/migrations/20261016_remove_competing_assign_trigger.sql
-- ==============================================================================

-- 1. Eliminar el trigger que competía con TypeScript en la asignación de trade_code
DROP TRIGGER IF EXISTS trg_assign_transaction_data ON transactions;
DROP TRIGGER IF EXISTS assign_transaction_data_trigger ON transactions;
DROP TRIGGER IF EXISTS assign_transaction_data ON transactions;

-- 2. Eliminar la función antigua para evitar errores de columnas obsoletas (position_status, etc.)
DROP FUNCTION IF EXISTS assign_transaction_data();
