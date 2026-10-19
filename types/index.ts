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
  trade_code?: number | null;
  action: string;
  symbol: string;
  unique_key: string;
  instrument: 'Stock' | 'Option';
  quantity: number;
  price: number;
  amount: number;
  fees?: number;
  strategy?: string | null;
  strategies?: { name: string } | null;
  position_status?: 'Open' | 'Closed' | string | null;
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
  instrument?: 'Stock' | 'Option';
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
  cash_flow?: number | null;
  realized_pnl?: number | null;
  initial_investment?: number | null;
  current_quantity?: number | null;
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

export interface TradeEnrichmentItem {
  trade_code: number;
  symbol: string;
  instrument: 'Stock' | 'Option';
  strategy_id: number | null;
  stock_entry_price: number | null;
  is_stock: boolean;
  suggested_price?: number | null;
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

// ==========================================
// EXECUTIVE DASHBOARD TYPES
// ==========================================

export interface AssetAllocationRow {
  strategy: string;
  stockValue: number;
  callValue: number;
  putValue: number;
  cashBalance: number;
  portfolioValue: number;
  allocationPct: number;
}

export interface AssetAllocationSummary {
  rows: AssetAllocationRow[];
  totalStockValue: number;
  totalCallValue: number;
  totalPutValue: number;
  totalCashBalance: number;
  totalPortfolioValue: number;
  stockPct: number;
  callPct: number;
  putPct: number;
  cashPct: number;
}

export interface StrategyPnLRow {
  strategy: string;
  closedPnL: number;
  openPnL: number;
  totalPnL: number;
}

export interface StrategyPnLSummary {
  rows: StrategyPnLRow[];
  totalClosedPnL: number;
  totalOpenPnL: number;
  grandTotalPnL: number;
  hedge?: {
    closedPnL: number;
    openPnL: number;
    totalPnL: number;
  };
}

export interface AuditMetricColumn {
  averageWinner: number;
  averageLoser: number;
  winLossRatio: number;
  winRatePct: number;
  expectancy: number;
  quantity: number;
  totalPnL: number;
}

export interface AuditMetricsSummary {
  closed: AuditMetricColumn;
  open: AuditMetricColumn;
  overall: AuditMetricColumn;
}

export interface RiskStrategyRow {
  strategy: string;
  totalPnL: number;
  initialInvestment: number;
  rMultiple: number;
}

export interface RiskMultiplesSummary {
  rows: RiskStrategyRow[];
  totalPnL: number;
  totalInitialInvestment: number;
  portfolioR: number;
  closedTradesCount: number;
  averageInitialInvestment: number;
}

export interface ExecutiveDashboardData {
  assetAllocation: AssetAllocationSummary;
  strategyPnL: StrategyPnLSummary;
  auditMetrics: AuditMetricsSummary;
  riskMultiples: RiskMultiplesSummary;
}

// ==========================================
// PORTFOLIO RISK TYPES
// ==========================================

export interface PositionRiskItem {
  id?: string;
  trade_code: string;
  symbol: string;
  strategy: string;
  currentPrice: number;
  stopPrice: number;
  distancePct: number;
  positionAmount: number;
  scenarioLoss: number;
  pctOfStrategy: number;
  pctOfPortfolio: number;
}

export interface StrategyRiskSummary {
  strategy: string;
  positionsCount: number;
  totalPositionAmount: number;
  totalScenarioLoss: number;
  pctOfPortfolioRisk: number;
}

export interface MarketDropLevel {
  dropPct: number;
  remainingCapital: number;
  stoppedOutCapital: number;
  stoppedPositionsCount: number;
}

export interface PortfolioRiskResult {
  summaries: StrategyRiskSummary[];
  positions: PositionRiskItem[];
  drops: MarketDropLevel[];
  totalCapital: number;
  totalRisk: number;
  overallRiskPct: number;
}

// ==========================================
// EQUITY CURVE & DRAWDOWN TYPES
// ==========================================

export interface EquityCurvePoint {
  index: number;
  trade_code: number;
  symbol: string;
  first_buy_date: string | null;
  closed_date: string | null;
  period_days: number;
  pnl: number;
  closed_equity: number;
  peak: number | null;
  running_peak: number;
  drawdown_amount: number;
  drawdown_pct: number;
  is_peak: boolean;
}

export interface EquityCurveSummary {
  points: EquityCurvePoint[];
  currentClosedEquity: number;
  maxHistoricalPeak: number;
  maxDrawdownAmount: number;
  maxDrawdownPct: number;
  maxUnderwaterTrades: number;
  maxUnderwaterDays: number;
  totalClosedTrades: number;
}

// ==========================================
// P&L HISTOGRAM & RISK STRATEGIES TYPES
// ==========================================

export interface HistogramBin {
  binIndex: number;
  binLower: number;
  binUpper: number;
  binMid: number;
  binLabel: string;
  f: number;
  rfd: number;
  crf: number;
}

export interface HistogramResult {
  min: number;
  max: number;
  mean: number;
  n: number;
  bins: HistogramBin[];
}

