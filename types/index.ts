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

export interface ConsolidatedStrategyStop {
  id: string;
  trade_code: string;
  symbol: string;
  strategy: string;
  entryPrice: number;
  lastPrice: number;
  stop: string | number;
  rentabilidad: number;
}
