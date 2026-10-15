// types/index.ts

export type ModuleType = 'positions' | 'transactions' | 'mk-tos';

export interface FileUpload {
  id: string;
  file_name: string;
  module: ModuleType | string;
  storage_path: string;
  created_at: string;
  is_archived?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  codigo?: number | null;
  trade_code?: number | null;
  action: string;
  symbol: string;
  unique_key: string;
  instrument: 'Stock' | 'Option';
  quantity: number;
  price: number;
  amount: number;
  fees?: number;
  stock_entry_price: number | null;
  strategy?: string | null;
  strategy_id?: number | null;
  strategies?: { name: string } | null;
  position_status: 'Open' | 'Closed';
  created_at?: string;
  file_upload_id?: string;
  account_id?: string;
  description?: string | null;
  trade?: Trade | null;
}

export interface Trade {
  id: string;
  trade_code: number;
  symbol: string;
  unique_key: string;
  strategy_id: number | null;
  strategies?: { name: string } | null;
  stock_entry_price: number | null;
  first_buy_date: string | null;
  status: 'Open' | 'Closed';
  weekend_trader_flag: boolean;
  max_stock_price?: number | null;
  max_stock_price_date?: string | null;
  ratchet_stop?: number | null;
  exit_stop?: number | null;
  exit_price?: number | null;
  exit_signal?: number | null;
  closed_date?: string | null;
  account_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Strategy {
  id: number;
  name: string;
  is_active: boolean;
  created_at?: string;
}

export interface Profile {
  id: string;
  role_id: number;
}

export interface Position {
  id: string;
  statement_date: string;
  unique_key: string;
  symbol: string;
  quantity: number;
  days: number;
  trade_price: number;
  stock_mark: number;
  stock_last: number;
  delta_position: number;
  theta: number;
  option_delta: number;
  option_theta: number;
  net_liq: number;
  created_at?: string;
  file_upload_id?: string;
}

export interface MkTosQuote {
  id: string;
  quote_date: string;
  symbol: string;
  description: string;
  last_price: number;
  high_52: number;
  low_52: number;
  ema: number;
  low_100_day: number;
  high_price: number;
  low_price: number;
  bollinger_bands: number;
  sma_10w: number;
  mac_stop: number;
  trendpilot_stop: number;
  sma_10d: number;
  sma_100d: number;
  file_upload_id?: string;
}

/** Fila de la tabla spy_daily_closes: SPY Last vs SMA 10W por fecha de cotización (filtro de mercado de Weekend Trader) */
export interface SpyDailyClose {
  quote_date: string;
  spy_last: number;
  spy_sma_10w: number;
  is_red?: boolean;
  file_upload_id?: string | null;
}

export interface ConsolidatedStrategyStop {
  id: string;
  trade_code: string;
  symbol: string;
  strategy: string;
  strategy_id?: number | null;
  entryPrice: number;
  signal?: number | null;
  lastPrice: number;
  first_buy_date?: string | null;
  weekend_trader_flag?: boolean;
  max_stock_price?: number | null;
  max_stock_price_date?: string | null;
  ratchet_stop?: number | null;
  stop: string | number;
  stopValue?: number | null;
  isStopRed?: boolean;
  needsReview?: boolean;
  reviewReason?: string;
  rentabilidad: number;
}
