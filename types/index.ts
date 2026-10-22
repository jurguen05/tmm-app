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
// PORTFOLIO CONSISTENCY & AUDIT TYPES
// ==========================================

export type ConsistencySeverity = 'red' | 'yellow';

export type ConsistencyIssueType =
  | 'GHOST_OPEN_TRADE'
  | 'ORPHAN_POSITION'
  | 'QUANTITY_MISMATCH'
  | 'MISSING_STRATEGY'
  | 'MISSING_MKTOS_QUOTE';

export interface ConsistencyIssue {
  id: string;
  type: ConsistencyIssueType;
  severity: ConsistencySeverity;
  trade_code?: number | null;
  symbol: string;
  unique_key?: string;
  instrument?: 'Stock' | 'Option';
  title: string;
  description: string;
  impact: string;
  suggestedAction: string;
  positionQuantity?: number;
  tradeQuantity?: number;
}

export interface ConsistencyAuditResult {
  hasIssues: boolean;
  maxSeverity: ConsistencySeverity | null;
  redCount: number;
  yellowCount: number;
  totalCount: number;
  issues: ConsistencyIssue[];
  auditedAt: string;
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
  averagePeriodDays: number;
  averagePeriodWinner: number;
  averagePeriodLoser: number;
  monthlyTransactions: number;
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
  needsReview?: boolean;
  reviewReason?: string;
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

// ==========================================
// HEDGING & MARIAN SHIELD (v4.0) TYPES
// ==========================================

export interface SpitznagelBudget {
  totalEquity: number;
  positionsValue: number;
  currentLeverage: number;
  baseTargetLeverage: number;
  leverageIncrease: number;
  isLayer2Active: boolean;
  excessUnits: number;
  qqqPrice: number;
  targetStrike: number;
  annualBaseBudget: number;
  monthlyBaseBudget: number;
  annualExposureBudget: number;
  monthlyExposureBudget: number;
  totalAnnualBudget: number;
  totalMonthlyBudget: number;
  monthlyTrancheBudget: number; // Promedio por tranche
  // Arquitectura 3-Tranche Spitznagel Ladder (30% / 40% / 30%):
  trancheABudgetMonthly: number; // 30% del presupuesto mensual (Tranche A: 30 DTE inicial -> roll a 180 DTE)
  trancheBBudgetMonthly: number; // 40% del presupuesto mensual (Tranche B: 90 DTE inicial -> roll a 180 DTE)
  trancheCBudgetMonthly: number; // 30% del presupuesto mensual (Tranche C: 180 DTE inicial -> roll a 180 DTE)
  trancheABudgetAnnual: number;
  trancheBBudgetAnnual: number;
  trancheCBudgetAnnual: number;
  totalHedgePct: number;
}

export type RollAlertStatus = 'OK' | 'ROLL_UP' | 'ROLL_FORWARD' | 'ROLL_BOTH';

export interface HedgeContractItem {
  id: string;
  symbol: string;
  unique_key: string;
  strike: number;
  expiration: string;
  days: number;
  quantity: number;
  net_liq: number;
  currentPrice: number;
  option_delta: number;
  option_theta: number;
  rollUpNeeded: boolean;
  rollForwardNeeded: boolean;
  status: RollAlertStatus;
}

export interface MarianShieldStep {
  dropPct: number;
  dropDecimal: number;
  qqqDropPrice: number;
  ivExpansionPts: number;
  projectedIV: number;
  remainingStockExposure: number;
  stoppedOutStockCapital: number;
  stockLossAmount: number;
  stockDrawdownPct: number;
  hedgeGainAmount: number;
  netLossAmount: number;
  bufferedDrawdownPct: number;
  intrinsicValuePerContract: number;
  extrinsicValuePerContract: number;
  totalHedgeValue: number;
}

export interface HedgingReviewItem {
  trade_code: string;
  symbol: string;
  strategy: string;
  positionAmount: number;
  reason?: string;
}

export interface HedgingDashboardData {
  budget: SpitznagelBudget;
  hedgeContracts: HedgeContractItem[];
  totalHedgeValue: number;
  baselineIV: number;
  marianShieldSteps: MarianShieldStep[];
  reviewCount: number;
  pendingReviews: HedgingReviewItem[];
}




// ==========================================
// MONTE CARLO SIMULATION & OPTIMAL F TYPES
// ==========================================

export interface MonteCarloParams {
  startingEquity: number;
  simulationsCount: number;
  tradesPerPath: number;
  ruinThresholdPct: number;
  minF: number;
  maxF: number;
  fSteps?: number;
  feeBps?: number;
  slippageBps?: number;
  tradesPerYear?: number;
  seed?: number;
  simulationF?: number;
}

export interface OptimalFPoint {
  f: number;
  medianCagr: number;
  medianFinalEquity: number;
  probRuin: number;
}

export interface MonteCarloPercentilePoint {
  tradeIndex: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface MonteCarloTradeReturn {
  tradeCode: number;
  symbol: string;
  realizedPnl: number;
  initialInvestment: number;
  returnPct: number;
  closedDate: string | null;
}

export interface MonteCarloResult {
  optimalF: number;
  peakCagr: number;
  optimalRuinProb: number;
  expectedMaxDrawdown95: number;
  medianMaxDrawdown: number;
  medianFinalEquity: number;
  optimalFPoints: OptimalFPoint[];
  percentileCurves: MonteCarloPercentilePoint[];
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  expectancy: number;
  profitFactor: number;
  activeF: number;
  params: MonteCarloParams;
}


// ==========================================
// CONTRACTS & INVESTOR MANAGEMENT MODULE
// ==========================================

export type ContractStatus = 'Open' | 'Closed';

export type InterestPayoutFrequency = 
  | 'MONTHLY' 
  | 'BIMONTHLY' 
  | 'SEMIANNUAL' 
  | 'ANNUAL' 
  | 'ON_DEMAND';

export type ContractMovementType = 
  | 'CAPITAL_DEPOSIT' 
  | 'CAPITAL_WITHDRAWAL' 
  | 'INTEREST_WITHDRAWAL';

export type SystemRoleType = 'OPERATOR' | 'INVESTOR' | 'NONE';

export interface Invitation {
  id: string;
  token: string;
  email?: string | null;
  name?: string | null;
  contact_id?: string | null;
  contact?: Partial<Contact> | null;
  role_id: number;
  is_investor: boolean;
  is_originator: boolean;
  status: 'Pending' | 'Accepted' | 'Expired';
  expires_at: string;
  created_at: string;
  accepted_at?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  tax_id?: string | null;
  address?: string | null;
  payout_info?: string | null;
  is_investor: boolean;
  is_originator: boolean;
  is_active?: boolean;
  user_id?: string | null;
  role_id?: number | null;        // Technical system role (1 = Operator, 2 = Investor)
  system_role?: SystemRoleType;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Aliases for clean architecture domain compatibility
export type Investor = Contact;
export type Originator = Contact;

export interface ContractRate {
  id: string;
  contract_id: string;
  effective_date: string;
  investor_annual_rate: number;    // e.g. 0.10 for 10% TNA
  originator_annual_rate: number;  // e.g. 0.02 for 2% TNA
  notes?: string | null;
  created_at?: string;
}

export interface ContractMovement {
  id: string;
  contract_id: string;
  movement_type: ContractMovementType;
  amount: number;
  movement_date: string;
  lockup_until?: string | null;
  agreed_withdrawal?: boolean;
  notes?: string | null;
  created_at?: string;
}

export interface Contract {
  id: string;
  contract_number: string;
  investor_name: string;
  investor_id?: string | null;
  investor?: Investor | null;
  user_id?: string | null;
  start_date: string;
  initial_amount: number;
  cutoff_day: number;
  payout_frequency?: InterestPayoutFrequency;
  originator_id?: string | null;
  originator?: Originator | null;
  status: ContractStatus;
  notes?: string | null;
  rates?: ContractRate[];
  movements?: ContractMovement[];
  created_at?: string;
  updated_at?: string;
}

export interface ContractMonthlyLedgerRow {
  period_index: number;
  cutoff_date: string;
  capital_prev: number;
  investor_rate: number;
  originator_rate: number;
  delta_interest: number;
  delta_originator_commission: number;
  delta_capital_deposit: number;
  capital_withdrawal: number;
  interest_withdrawal: number;
  capital_end: number;
}

export interface LockedDepositItem {
  amount: number;
  deposit_date: string;
  lockup_until: string;
  days_remaining: number;
}

export interface ContractFinancialSummary {
  total_capital: number;
  withdrawable_capital: number;      // > 6 months
  locked_capital: number;            // < 6 months
  accumulated_interest: number;
  withdrawn_interest: number;
  available_interest: number;
  originator_accumulated_commissions: number;
  originator_pending_commissions: number;
  payout_frequency?: InterestPayoutFrequency;
  next_payout_date?: string | null;
  is_closed: boolean;
  locked_deposits: LockedDepositItem[];
}
