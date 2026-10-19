-- ==============================================================================
-- Migration: Assign strategies and stock entry prices for historical closed trades
-- File: supabase/migrations/20261016_update_trades_strategies_and_entry_prices.sql
-- ==============================================================================

DO $$
DECLARE
    v_strat_20_flipper BIGINT;
    v_strat_100_day BIGINT;
    v_strat_new_yearly BIGINT;
    v_strat_tech_trader BIGINT;
BEGIN
    -- 1. Obtener los IDs de las estrategias
    SELECT id INTO v_strat_20_flipper FROM strategies WHERE name ILIKE '%flipper%' LIMIT 1;
    SELECT id INTO v_strat_100_day FROM strategies WHERE name ILIKE '%100-day%' LIMIT 1;
    SELECT id INTO v_strat_new_yearly FROM strategies WHERE name ILIKE '%yearly%' LIMIT 1;
    SELECT id INTO v_strat_tech_trader FROM strategies WHERE name ILIKE '%tech%' LIMIT 1;

    -- 2. Actualizar trades
    -- 514: 20%-Flipper, 79.12, AAOI
    UPDATE trades 
    SET strategy_id = v_strat_20_flipper, stock_entry_price = 79.12
    WHERE trade_code = 514;

    -- 118: 100-day-High, 4.06, ACHR
    UPDATE trades 
    SET strategy_id = v_strat_100_day, stock_entry_price = 4.06
    WHERE trade_code = 118;

    -- 99: 100-day-High, 7.61, AMPX
    UPDATE trades 
    SET strategy_id = v_strat_100_day, stock_entry_price = 7.61
    WHERE trade_code = 99;

    -- 112: New Yearly Highs, 2.15, ASPI
    UPDATE trades 
    SET strategy_id = v_strat_new_yearly, stock_entry_price = 2.15
    WHERE trade_code = 112;

    -- 485: TechTrader, 23.76, ASST
    UPDATE trades 
    SET strategy_id = v_strat_tech_trader, stock_entry_price = 23.76
    WHERE trade_code = 485;

    -- 445: 20%-Flipper, 21.22, BMNR
    UPDATE trades 
    SET strategy_id = v_strat_20_flipper, stock_entry_price = 21.22
    WHERE trade_code = 445;

    -- 233: TechTrader, 136.45, BNY
    UPDATE trades 
    SET strategy_id = v_strat_tech_trader, stock_entry_price = 136.45
    WHERE trade_code = 233;

    -- 486: 100-day-High, 244.64, CRWD
    UPDATE trades 
    SET strategy_id = v_strat_100_day, stock_entry_price = 244.64
    WHERE trade_code = 486;

    -- 105: 100-day-High, 6.06, FLNC
    UPDATE trades 
    SET strategy_id = v_strat_100_day, stock_entry_price = 6.06
    WHERE trade_code = 105;

    -- 391: 100-day-High, 31.12, IONQ
    UPDATE trades 
    SET strategy_id = v_strat_100_day, stock_entry_price = 31.12
    WHERE trade_code = 391;

    -- 10: 100-day-High, 4.53, JOBY
    UPDATE trades 
    SET strategy_id = v_strat_100_day, stock_entry_price = 4.53
    WHERE trade_code = 10;

    -- 124: 100-day-High, 8.94, NVTS
    UPDATE trades 
    SET strategy_id = v_strat_100_day, stock_entry_price = 8.94
    WHERE trade_code = 124;

    -- 225: 100-day-High, 6.03, ONDS
    UPDATE trades 
    SET strategy_id = v_strat_100_day, stock_entry_price = 6.03
    WHERE trade_code = 225;

    -- 168: 100-day-High, 12.74, RIVN
    UPDATE trades 
    SET strategy_id = v_strat_100_day, stock_entry_price = 12.74
    WHERE trade_code = 168;

    -- 471: 20%-Flipper, 30.84, SMCI
    UPDATE trades 
    SET strategy_id = v_strat_20_flipper, stock_entry_price = 30.84
    WHERE trade_code = 471;

    -- 510: TechTrader, 144.90, SPCX
    UPDATE trades 
    SET strategy_id = v_strat_tech_trader, stock_entry_price = 144.90
    WHERE trade_code = 510;
END $$;
