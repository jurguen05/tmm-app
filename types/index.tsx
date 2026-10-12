export interface Transaction {
  id: string;
  date: string;
  codigo?: number | null;
  trade_code?: number | null;
  action: string;
  symbol: string;
  unique_key: string;
  instrument: 'Stock' | 'Option'; // Limitamos las opciones posibles
  quantity: number;
  price: number;
  amount: number;
  stock_entry_price: number | null;
  strategy?: string | null;
  strategy_id?: number | null;
  strategies?: { name: string } | null;
  position_status: 'Open' | 'Closed';
  created_at?: string;
  file_upload_id?: string;
  account_id?: string;
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
}