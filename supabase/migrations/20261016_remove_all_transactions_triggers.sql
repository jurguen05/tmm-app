-- ==============================================================================
-- Migration: Remove all competing triggers on 'transactions' table
-- File: supabase/migrations/20261016_remove_all_transactions_triggers.sql
-- ==============================================================================

-- 1. Eliminar trigger 'trg_after_change_transaction' y su función
DROP TRIGGER IF EXISTS trg_after_change_transaction ON transactions;
DROP FUNCTION IF EXISTS update_transaction_status();

-- 2. Eliminar trigger 'trg_sync_trade_metrics' y su función
DROP TRIGGER IF EXISTS trg_sync_trade_metrics ON transactions;
DROP FUNCTION IF EXISTS sync_trade_metrics_from_transactions();

-- 3. Eliminar cualquier residuo de 'trg_assign_transaction_data' por seguridad
DROP TRIGGER IF EXISTS trg_assign_transaction_data ON transactions;
DROP TRIGGER IF EXISTS assign_transaction_data_trigger ON transactions;
DROP TRIGGER IF EXISTS assign_transaction_data ON transactions;
DROP FUNCTION IF EXISTS assign_transaction_data();
