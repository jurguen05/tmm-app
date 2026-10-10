// types/index.ts

export interface Transaction {
  id: string;
  date: string;
  codigo: number | null;
  action: string;
  symbol: string;
  unique_key: string;
  instrument: 'Stock' | 'Option'; // Limitamos las opciones posibles
  quantity: number;
  price: number;
  amount: number;
  stock_entry_price: number | null;
  strategy: string | null;
  position_status: 'Open' | 'Closed';
  created_at?: string;
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