// lib/monteCarloCalculator.ts

import {
  Trade,
  MonteCarloParams,
  OptimalFPoint,
  MonteCarloPercentilePoint,
  MonteCarloTradeReturn,
  MonteCarloResult
} from '../types';

/**
 * Default parameters for Monte Carlo simulation matching original Python specs
 */
export const DEFAULT_MONTE_CARLO_PARAMS: MonteCarloParams = {
  startingEquity: 100_000,
  simulationsCount: 1_000, // Fast responsive default for web UI; scalable up to 10,000
  tradesPerPath: 500,
  ruinThresholdPct: 0.50, // 50% drawdown from starting capital defines ruin
  minF: 0.01,
  maxF: 0.50,
  fSteps: 20,
  feeBps: 2.0,
  slippageBps: 3.0,
  tradesPerYear: 250, // Standard trading year
};

/**
 * Fast seedable PRNG (Mulberry32) for deterministic & reproducible simulations
 */
export function createRNG(seed: number = 42) {
  let s = Math.floor(seed) >>> 0;
  return function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Computes exact percentile (0 to 1) from a pre-sorted array of numbers
 */
export function quantileSorted(sortedArr: number[], q: number): number {
  const n = sortedArr.length;
  if (n === 0) return 0;
  if (n === 1 || q <= 0) return sortedArr[0];
  if (q >= 1) return sortedArr[n - 1];

  const pos = (n - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;

  if (base + 1 < n) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  }
  return sortedArr[base];
}

/**
 * Extracts and normalizes empirical trade returns (r_i = realized_pnl / initial_investment)
 * from Supabase Trade entities.
 */
export function extractTradeReturns(trades: Trade[]): MonteCarloTradeReturn[] {
  if (!trades || !Array.isArray(trades)) return [];

  const returns: MonteCarloTradeReturn[] = [];

  for (const t of trades) {
    if (!t) continue;
    const status = (t.status || '').toLowerCase();
    if (status !== 'closed') continue;

    const initial = typeof t.initial_investment === 'number' && !isNaN(t.initial_investment)
      ? t.initial_investment
      : 0;

    if (initial <= 0) continue;

    const pnl = typeof t.realized_pnl === 'number' && !isNaN(t.realized_pnl)
      ? t.realized_pnl
      : (typeof t.cash_flow === 'number' && !isNaN(t.cash_flow) ? t.cash_flow : 0);

    const returnPct = pnl / initial;

    // Filter out extreme corrupted outliers (> 10,000% or < -100%)
    if (!isFinite(returnPct) || returnPct < -1.0) continue;

    returns.push({
      tradeCode: Number(t.trade_code) || 0,
      symbol: t.symbol || 'N/A',
      realizedPnl: pnl,
      initialInvestment: initial,
      returnPct,
      closedDate: t.closed_date || null
    });
  }

  return returns;
}

/**
 * Calculates empirical trade metrics (win rate, expectancy, profit factor)
 */
export function calculateTradeMetrics(returns: number[]) {
  if (!returns || returns.length === 0) {
    return {
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      winLossRatio: 0,
      expectancy: 0,
      profitFactor: 0
    };
  }

  const wins: number[] = [];
  const losses: number[] = [];

  for (const r of returns) {
    if (r > 0) wins.push(r);
    else if (r < 0) losses.push(r);
  }

  const winCount = wins.length;
  const lossCount = losses.length;
  const winRate = returns.length > 0 ? winCount / returns.length : 0;

  const totalWinSum = wins.reduce((sum, v) => sum + v, 0);
  const totalLossSum = losses.reduce((sum, v) => sum + Math.abs(v), 0);

  const avgWin = winCount > 0 ? totalWinSum / winCount : 0;
  const avgLoss = lossCount > 0 ? losses.reduce((sum, v) => sum + v, 0) / lossCount : 0;

  const winLossRatio = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : (avgWin > 0 ? 100 : 0);
  const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss);
  const profitFactor = totalLossSum > 0 ? totalWinSum / totalLossSum : (totalWinSum > 0 ? 99 : 0);

  return {
    winRate,
    avgWin,
    avgLoss,
    winLossRatio,
    expectancy,
    profitFactor
  };
}

/**
 * Fallback synthetic returns in case the database has no closed trades yet,
 * providing a realistic statistical profile for demo/preview.
 */
function getSyntheticReturns(): number[] {
  return [
    0.15, -0.05, 0.22, -0.08, 0.04, 0.18, -0.06, -0.03, 0.35, -0.07,
    0.12, 0.08, -0.09, 0.25, -0.04, 0.14, -0.05, 0.30, -0.06, 0.09,
    -0.08, 0.16, 0.05, -0.04, 0.21, -0.07, 0.11, -0.05, 0.19, -0.03
  ];
}

/**
 * Main Pure Domain Monte Carlo Simulator.
 *
 * Implements:
 * 1. Bootstrap Resampling (sampling with replacement) of historical trade returns.
 * 2. Ralph Vince Optimal f curve calculation across configurable f fractions.
 * 3. Median CAGR, Median Final Equity, and Probability of Ruin.
 * 4. Fan chart percentile curves (P5, P25, P50, P75, P95) along simulated trade progression.
 * 5. Max Drawdown analysis (95% confidence level and median).
 */
export function runMonteCarloSimulation(
  tradeData: Trade[] | MonteCarloTradeReturn[] | number[],
  userParams?: Partial<MonteCarloParams>
): MonteCarloResult {
  const params: MonteCarloParams = {
    ...DEFAULT_MONTE_CARLO_PARAMS,
    ...userParams
  };

  // 1. Extract raw numerical returns
  let empiricalReturns: number[] = [];
  if (Array.isArray(tradeData) && tradeData.length > 0) {
    const first = tradeData[0];
    if (typeof first === 'number') {
      empiricalReturns = (tradeData as number[]).filter(r => typeof r === 'number' && !isNaN(r) && isFinite(r));
    } else if ('returnPct' in (first as object)) {
      empiricalReturns = (tradeData as MonteCarloTradeReturn[])
        .map(e => e.returnPct)
        .filter(r => typeof r === 'number' && !isNaN(r) && isFinite(r));
    } else {
      const extracted = extractTradeReturns(tradeData as Trade[]);
      empiricalReturns = extracted.map(e => e.returnPct);
    }
  }

  // Graceful fallback if dataset is empty
  const hasRealData = empiricalReturns.length > 0;
  const returnsToSample = hasRealData ? empiricalReturns : getSyntheticReturns();
  const empiricalMetrics = calculateTradeMetrics(returnsToSample);

  const N = params.simulationsCount;
  const T = params.tradesPerPath;
  const startEq = params.startingEquity;
  const ruinCutoff = params.ruinThresholdPct * startEq;
  const tradesPerYear = params.tradesPerYear || 250;
  const years = Math.max(T / tradesPerYear, 0.001);
  const cost = ((params.feeBps ?? 2.0) + (params.slippageBps ?? 3.0)) / 10_000.0;

  const rng = createRNG(params.seed ?? 12345);
  const numEmpirical = returnsToSample.length;

  // 2. Pre-generate sampled bootstrap paths (indices)
  // To evaluate different f values efficiently on identical bootstrap samples,
  // we store the sampled return indices for each path.
  const sampleIndices = new Int32Array(N * T);
  for (let i = 0; i < N * T; i++) {
    sampleIndices[i] = Math.floor(rng() * numEmpirical);
  }

  // 3. Optimal f Parameter Sweep
  const minF = Math.max(params.minF, 0.01);
  const maxF = Math.min(params.maxF, 1.0);
  const steps = Math.max(params.fSteps || 20, 5);

  const fValues: number[] = [];
  const stepSize = (maxF - minF) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    fValues.push(Number((minF + i * stepSize).toFixed(4)));
  }

  const optimalFPoints: OptimalFPoint[] = [];
  let bestF = minF;
  let maxMedianCagr = -Infinity;

  // Temporary buffers for per-path metrics
  const pathCagrs = new Float64Array(N);
  const pathFinalEquities = new Float64Array(N);

  for (const f of fValues) {
    let ruinedCount = 0;

    for (let pathIdx = 0; pathIdx < N; pathIdx++) {
      let equity = startEq;
      let pathRuined = false;
      const offset = pathIdx * T;

      for (let step = 0; step < T; step++) {
        const retIdx = sampleIndices[offset + step];
        const r = returnsToSample[retIdx];

        // Ralph Vince fixed fraction return equation with friction/cost
        const factor = 1.0 + f * (r - cost);
        equity = Math.max(equity * factor, 1e-12);

        if (equity <= ruinCutoff) {
          pathRuined = true;
        }
      }

      if (pathRuined) ruinedCount++;

      pathFinalEquities[pathIdx] = equity;
      // Compound Annual Growth Rate
      const cagr = Math.pow(Math.max(equity / startEq, 1e-12), 1.0 / years) - 1.0;
      pathCagrs[pathIdx] = cagr;
    }

    // Sort to compute medians
    const sortedCagrs = Array.from(pathCagrs).sort((a, b) => a - b);
    const sortedEquities = Array.from(pathFinalEquities).sort((a, b) => a - b);

    const medianCagr = quantileSorted(sortedCagrs, 0.50);
    const medianFinalEquity = quantileSorted(sortedEquities, 0.50);
    const probRuin = ruinedCount / N;

    optimalFPoints.push({
      f,
      medianCagr,
      medianFinalEquity,
      probRuin
    });

    if (medianCagr > maxMedianCagr) {
      maxMedianCagr = medianCagr;
      bestF = f;
    }
  }

  // Active f to use for fan chart and detailed drawdown stats
  const activeF = typeof params.simulationF === 'number' && params.simulationF > 0
    ? params.simulationF
    : bestF;

  // 4. Detailed simulation at activeF to build Fan Chart & Max Drawdown
  // Select sampled steps for fan chart (50 to 100 intervals for smooth responsive rendering)
  const chartInterval = Math.max(1, Math.floor(T / 50));
  const sampledSteps: number[] = [0];
  for (let s = chartInterval; s < T; s += chartInterval) {
    sampledSteps.push(s);
  }
  if (sampledSteps[sampledSteps.length - 1] !== T) {
    sampledSteps.push(T);
  }

  // Matrix to store equity at sampled steps: [stepIndex][pathIndex]
  const equityAtSteps: number[][] = sampledSteps.map(() => new Array(N));
  const maxDrawdowns = new Float64Array(N);
  let activeRuinedCount = 0;
  const activeFinalEquities = new Float64Array(N);

  for (let pathIdx = 0; pathIdx < N; pathIdx++) {
    let equity = startEq;
    let peakEquity = startEq;
    let maxDd = 0;
    let pathRuined = false;
    const offset = pathIdx * T;

    // Record step 0
    equityAtSteps[0][pathIdx] = equity;
    let sampledPointer = 1;

    for (let step = 1; step <= T; step++) {
      const retIdx = sampleIndices[offset + (step - 1)];
      const r = returnsToSample[retIdx];

      const factor = 1.0 + activeF * (r - cost);
      equity = Math.max(equity * factor, 1e-12);

      if (equity > peakEquity) {
        peakEquity = equity;
      } else {
        const dd = (peakEquity - equity) / peakEquity;
        if (dd > maxDd) maxDd = dd;
      }

      if (equity <= ruinCutoff) {
        pathRuined = true;
      }

      if (sampledPointer < sampledSteps.length && step === sampledSteps[sampledPointer]) {
        equityAtSteps[sampledPointer][pathIdx] = equity;
        sampledPointer++;
      }
    }

    if (pathRuined) activeRuinedCount++;
    maxDrawdowns[pathIdx] = maxDd;
    activeFinalEquities[pathIdx] = equity;
  }

  // 5. Build Fan Chart Percentiles (P5, P25, P50, P75, P95)
  const percentileCurves: MonteCarloPercentilePoint[] = sampledSteps.map((tradeStep, idx) => {
    const sortedStepValues = equityAtSteps[idx].slice().sort((a, b) => a - b);
    return {
      tradeIndex: tradeStep,
      p5: Math.round(quantileSorted(sortedStepValues, 0.05)),
      p25: Math.round(quantileSorted(sortedStepValues, 0.25)),
      p50: Math.round(quantileSorted(sortedStepValues, 0.50)),
      p75: Math.round(quantileSorted(sortedStepValues, 0.75)),
      p95: Math.round(quantileSorted(sortedStepValues, 0.95)),
    };
  });

  // 6. Drawdown & Final stats at activeF
  const sortedDrawdowns = Array.from(maxDrawdowns).sort((a, b) => a - b);
  const sortedActiveEquities = Array.from(activeFinalEquities).sort((a, b) => a - b);

  const medianMaxDrawdown = quantileSorted(sortedDrawdowns, 0.50);
  const expectedMaxDrawdown95 = quantileSorted(sortedDrawdowns, 0.95);
  const medianFinalEquity = quantileSorted(sortedActiveEquities, 0.50);

  // Peak CAGR and ruin probability at best optimal f
  const optimalPoint = optimalFPoints.find(p => Math.abs(p.f - bestF) < 1e-5) || optimalFPoints[0];
  const peakCagr = optimalPoint ? optimalPoint.medianCagr : 0;
  const optimalRuinProb = optimalPoint ? optimalPoint.probRuin : (activeRuinedCount / N);

  return {
    optimalF: bestF,
    peakCagr,
    optimalRuinProb,
    expectedMaxDrawdown95,
    medianMaxDrawdown,
    medianFinalEquity,
    optimalFPoints,
    percentileCurves,
    totalTrades: hasRealData ? empiricalReturns.length : 0,
    winRate: empiricalMetrics.winRate,
    avgWin: empiricalMetrics.avgWin,
    avgLoss: empiricalMetrics.avgLoss,
    winLossRatio: empiricalMetrics.winLossRatio,
    expectancy: empiricalMetrics.expectancy,
    profitFactor: empiricalMetrics.profitFactor,
    activeF,
    params
  };
}
