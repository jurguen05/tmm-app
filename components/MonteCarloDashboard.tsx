'use client';

import React, { useState, useMemo, useTransition } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  MonteCarloResult,
  MonteCarloTradeReturn,
  MonteCarloParams,
  OptimalFPoint,
  MonteCarloPercentilePoint
} from '../types';
import { runMonteCarloSimulation, DEFAULT_MONTE_CARLO_PARAMS } from '../lib/monteCarloCalculator';

interface MonteCarloDashboardProps {
  initialResult: MonteCarloResult;
  initialReturns: MonteCarloTradeReturn[];
}

export default function MonteCarloDashboard({
  initialResult,
  initialReturns
}: MonteCarloDashboardProps) {
  const [isPending, startTransition] = useTransition();

  // Simulation parameters state
  const [startingEquity, setStartingEquity] = useState<number>(
    initialResult.params.startingEquity || DEFAULT_MONTE_CARLO_PARAMS.startingEquity
  );
  const [simulationsCount, setSimulationsCount] = useState<number>(
    initialResult.params.simulationsCount || DEFAULT_MONTE_CARLO_PARAMS.simulationsCount
  );
  const [tradesPerPath, setTradesPerPath] = useState<number>(
    initialResult.params.tradesPerPath || DEFAULT_MONTE_CARLO_PARAMS.tradesPerPath
  );
  const [ruinThresholdPct, setRuinThresholdPct] = useState<number>(
    initialResult.params.ruinThresholdPct || DEFAULT_MONTE_CARLO_PARAMS.ruinThresholdPct
  );
  const [maxF, setMaxF] = useState<number>(
    initialResult.params.maxF || DEFAULT_MONTE_CARLO_PARAMS.maxF
  );
  const [selectedF, setSelectedF] = useState<number>(initialResult.optimalF);

  // Result state
  const [result, setResult] = useState<MonteCarloResult>(initialResult);
  const [activeTab, setActiveTab] = useState<'charts' | 'trades'>('charts');

  // Trigger recalculation using transition for smooth responsive UI
  const handleRunSimulation = (customF?: number) => {
    const activeSimulationF = customF !== undefined ? customF : selectedF;
    startTransition(() => {
      const updatedParams: Partial<MonteCarloParams> = {
        startingEquity,
        simulationsCount,
        tradesPerPath,
        ruinThresholdPct,
        minF: 0.01,
        maxF,
        fSteps: 20,
        feeBps: 2.0,
        slippageBps: 3.0,
        tradesPerYear: 250,
        simulationF: activeSimulationF
      };

      const newResult = runMonteCarloSimulation(initialReturns, updatedParams);
      setResult(newResult);
      if (customF !== undefined) {
        setSelectedF(customF);
      }
    });
  };

  const handleResetToOptimalF = () => {
    handleRunSimulation(result.optimalF);
  };

  // Formatters (English UI)
  const formatCurrency = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatPercentage = (val: number | null | undefined, decimals = 1): string => {
    if (val === null || val === undefined || isNaN(val)) return '0.0%';
    return `${(val * 100).toFixed(decimals)}%`;
  };

  const ruinThresholdValue = startingEquity * ruinThresholdPct;

  // Custom Tooltip for Optimal f Chart
  const OptimalFTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt: OptimalFPoint = payload[0].payload;
    const isOptimal = Math.abs(pt.f - result.optimalF) < 1e-4;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs text-white space-y-2 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
          <span className="font-semibold text-slate-300">Fraction f:</span>
          <span className="font-bold text-indigo-400 text-sm">{pt.f.toFixed(3)}</span>
        </div>
        {isOptimal && (
          <div className="bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded text-[11px] text-center border border-emerald-500/30">
            ★ Recommended Optimal f
          </div>
        )}
        <div className="space-y-1 pt-0.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Median CAGR:</span>
            <span className="font-bold text-blue-400">{formatPercentage(pt.medianCagr)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Prob. of Ruin:</span>
            <span className={`font-bold ${pt.probRuin > 0.10 ? 'text-rose-400' : 'text-slate-200'}`}>
              {formatPercentage(pt.probRuin)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1">
            <span className="text-slate-400">Median Final Equity:</span>
            <span className="font-semibold text-purple-300">{formatCurrency(pt.medianFinalEquity)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Custom Tooltip for Capital Fan Chart
  const FanChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pt: MonteCarloPercentilePoint = payload[0].payload;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs text-white space-y-2 min-w-[240px]">
        <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
          <span className="font-semibold text-slate-300">Simulated Trade Step:</span>
          <span className="font-bold text-indigo-400 text-sm">#{pt.tradeIndex}</span>
        </div>
        <div className="space-y-1 pt-0.5">
          <div className="flex justify-between text-emerald-400">
            <span>P95 (Top 5% Best):</span>
            <span className="font-bold">{formatCurrency(pt.p95)}</span>
          </div>
          <div className="flex justify-between text-cyan-300">
            <span>P75 (Upper Quartile):</span>
            <span className="font-semibold">{formatCurrency(pt.p75)}</span>
          </div>
          <div className="flex justify-between text-blue-400 font-bold border-y border-slate-800 py-1">
            <span>P50 (Median Path):</span>
            <span className="text-sm">{formatCurrency(pt.p50)}</span>
          </div>
          <div className="flex justify-between text-amber-400">
            <span>P25 (Lower Quartile):</span>
            <span className="font-semibold">{formatCurrency(pt.p25)}</span>
          </div>
          <div className="flex justify-between text-rose-400">
            <span>P5 (Worst 5% Drawdown):</span>
            <span className="font-bold">{formatCurrency(pt.p5)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎲</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Monte Carlo & Optimal f Sizing
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Ralph Vince Model
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Stochastic bootstrap resampling, geometric growth curve optimization, and capital drawdown fan analysis.
              </p>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'charts'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Simulation & Charts
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'trades'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Trade Returns Sample ({result.totalTrades})
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recommended Optimal f */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Optimal f (Vince)
            </span>
            <span className="text-base">🎯</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-indigo-600">
              {result.optimalF.toFixed(3)}
            </span>
            <span className="text-xs text-gray-500 font-medium">fraction</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Peak geometric growth fraction across {simulationsCount.toLocaleString()} bootstrap runs.
          </p>
        </div>

        {/* Peak Median CAGR */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Peak Median CAGR
            </span>
            <span className="text-base">📈</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${result.peakCagr >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatPercentage(result.peakCagr)}
            </span>
            <span className="text-xs text-gray-500 font-medium">annualized</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Median compound annual growth rate at Optimal f.
          </p>
        </div>

        {/* Probability of Ruin */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Ruin Probability
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
              result.optimalRuinProb <= 0.05
                ? 'bg-emerald-50 text-emerald-700'
                : result.optimalRuinProb <= 0.20
                ? 'bg-amber-50 text-amber-700'
                : 'bg-rose-50 text-rose-700'
            }`}>
              {result.optimalRuinProb <= 0.05 ? 'Low Risk' : result.optimalRuinProb <= 0.20 ? 'Moderate' : 'High Risk'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${
              result.optimalRuinProb <= 0.05 ? 'text-emerald-600' : result.optimalRuinProb <= 0.20 ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {formatPercentage(result.optimalRuinProb)}
            </span>
            <span className="text-xs text-gray-500 font-medium">at f = {result.optimalF.toFixed(3)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Paths dropping below {(ruinThresholdPct * 100).toFixed(0)}% of starting capital.
          </p>
        </div>

        {/* Expected Max Drawdown 95% */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Max Drawdown (95% Conf.)
            </span>
            <span className="text-base">🛡️</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600">
              -{formatPercentage(result.expectedMaxDrawdown95)}
            </span>
            <span className="text-xs text-gray-500 font-medium">95th pct</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Worst-case peak-to-trough decline (median: -{formatPercentage(result.medianMaxDrawdown)}).
          </p>
        </div>
      </div>

      {/* Control Panel Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Simulation Parameters & Sizing Controls
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Adjust starting capital, path iterations, and risk limits in real-time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetToOptimalF}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
            >
              Reset to Optimal f ({result.optimalF.toFixed(3)})
            </button>
            <button
              onClick={() => handleRunSimulation()}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Simulating...
                </>
              ) : (
                <>▶ Run Simulation</>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 text-xs">
          {/* Starting Equity */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-700 block">
              Starting Capital: <span className="text-indigo-600 font-bold">{formatCurrency(startingEquity)}</span>
            </label>
            <input
              type="range"
              min="10000"
              max="500000"
              step="10000"
              value={startingEquity}
              onChange={e => setStartingEquity(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>$10k</span>
              <span>$100k</span>
              <span>$500k</span>
            </div>
          </div>

          {/* Simulations Count */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-700 block">
              Bootstrap Paths: <span className="text-indigo-600 font-bold">{simulationsCount.toLocaleString()}</span>
            </label>
            <input
              type="range"
              min="500"
              max="10000"
              step="500"
              value={simulationsCount}
              onChange={e => setSimulationsCount(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>500</span>
              <span>5,000</span>
              <span>10,000</span>
            </div>
          </div>

          {/* Trades per Path */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-700 block">
              Trades per Path: <span className="text-indigo-600 font-bold">{tradesPerPath}</span>
            </label>
            <input
              type="range"
              min="100"
              max="1000"
              step="50"
              value={tradesPerPath}
              onChange={e => setTradesPerPath(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>100</span>
              <span>500</span>
              <span>1,000</span>
            </div>
          </div>

          {/* Ruin Threshold */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-700 block">
              Ruin Threshold: <span className="text-rose-600 font-bold">{(ruinThresholdPct * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0.20"
              max="0.80"
              step="0.05"
              value={ruinThresholdPct}
              onChange={e => setRuinThresholdPct(Number(e.target.value))}
              className="w-full accent-rose-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>20%</span>
              <span>50%</span>
              <span>80%</span>
            </div>
          </div>

          {/* Active Simulation f */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-700 block">
              Active Fraction f: <span className="text-purple-600 font-bold">{selectedF.toFixed(3)}</span>
            </label>
            <input
              type="range"
              min="0.01"
              max={maxF}
              step="0.01"
              value={selectedF}
              onChange={e => setSelectedF(Number(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>0.01</span>
              <span>Optimal: {result.optimalF.toFixed(2)}</span>
              <span>{maxF.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'charts' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 1. Optimal f Curve Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-gray-900">
                  Ralph Vince Optimal f Curve
                </h3>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                  Dual Axis
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Median CAGR (left axis, blue) vs Probability of Ruin (right axis, red) across position fractions.
              </p>
            </div>

            <div className="w-full h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={result.optimalFPoints}
                  margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="f"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={v => v.toFixed(2)}
                    label={{
                      value: 'Fraction f (Position Sizing)',
                      position: 'insideBottom',
                      offset: -12,
                      fill: '#64748b',
                      fontSize: 11
                    }}
                  />
                  {/* Left Axis: Median CAGR */}
                  <YAxis
                    yAxisId="left"
                    stroke="#3b82f6"
                    fontSize={11}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    domain={['auto', 'auto']}
                  />
                  {/* Right Axis: Ruin Probability */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#ef4444"
                    fontSize={11}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    domain={[0, 1]}
                  />
                  <Tooltip content={<OptimalFTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={32}
                    iconSize={10}
                    wrapperStyle={{ fontSize: '11px' }}
                  />

                  {/* Highlight Optimal f Line */}
                  <ReferenceLine
                    yAxisId="left"
                    x={result.optimalF}
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `Optimal f (${result.optimalF.toFixed(3)})`,
                      fill: '#059669',
                      fontSize: 11,
                      position: 'top'
                    }}
                  />

                  {/* Median CAGR Line */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="medianCagr"
                    name="Median CAGR"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#2563eb' }}
                    activeDot={{ r: 6 }}
                  />

                  {/* Ruin Probability Line */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="probRuin"
                    name="Probability of Ruin"
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={{ r: 3, fill: '#ef4444' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Peak Return Fraction: <strong className="text-gray-900">{result.optimalF.toFixed(3)}</strong></span>
              <span>Median Final Equity: <strong className="text-gray-900">{formatCurrency(result.medianFinalEquity)}</strong></span>
            </div>
          </div>

          {/* 2. Capital Fan Chart (Percentile Bands) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-gray-900">
                  Capital Fan Chart (Percentile Bands)
                </h3>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">
                  Active f = {result.activeF.toFixed(3)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Equity evolution trajectories across simulated trade sequence (P5 to P95 confidence envelope).
              </p>
            </div>

            <div className="w-full h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={result.percentileCurves}
                  margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="tradeIndex"
                    stroke="#94a3b8"
                    fontSize={11}
                    label={{
                      value: 'Simulated Trade Sequence (#)',
                      position: 'insideBottom',
                      offset: -12,
                      fill: '#64748b',
                      fontSize: 11
                    }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={v => {
                      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                      if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
                      return `$${v}`;
                    }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<FanChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={32}
                    iconSize={10}
                    wrapperStyle={{ fontSize: '11px' }}
                  />

                  {/* Starting Capital Baseline */}
                  <ReferenceLine
                    y={startingEquity}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: `Start ($${(startingEquity / 1000).toFixed(0)}k)`,
                      fill: '#64748b',
                      fontSize: 10,
                      position: 'insideBottomLeft'
                    }}
                  />

                  {/* Ruin Threshold Reference Line */}
                  <ReferenceLine
                    y={ruinThresholdValue}
                    stroke="#f43f5e"
                    strokeDasharray="3 3"
                    label={{
                      value: `Ruin Cutoff ($${(ruinThresholdValue / 1000).toFixed(0)}k)`,
                      fill: '#e11d48',
                      fontSize: 10,
                      position: 'insideBottomLeft'
                    }}
                  />

                  {/* P95 Line (Best 5%) */}
                  <Line
                    type="monotone"
                    dataKey="p95"
                    name="P95 (Top 5%)"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />

                  {/* P75 Line (Upper Quartile) */}
                  <Line
                    type="monotone"
                    dataKey="p75"
                    name="P75 (Upper 25%)"
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    dot={false}
                  />

                  {/* P50 Line (Median Path) */}
                  <Line
                    type="monotone"
                    dataKey="p50"
                    name="P50 (Median)"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={false}
                  />

                  {/* P25 Line (Lower Quartile) */}
                  <Line
                    type="monotone"
                    dataKey="p25"
                    name="P25 (Lower 25%)"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    dot={false}
                  />

                  {/* P5 Line (Worst 5%) */}
                  <Line
                    type="monotone"
                    dataKey="p5"
                    name="P5 (Worst 5%)"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Expected 95% MDD: <strong className="text-rose-600">-{formatPercentage(result.expectedMaxDrawdown95)}</strong></span>
              <span>Median P50 Ending: <strong className="text-blue-600">{formatCurrency(result.medianFinalEquity)}</strong></span>
            </div>
          </div>
        </div>
      ) : (
        /* Trade Returns Data Table View */
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Historical Empirical Returns Dataset
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Closed trades used as source population for Monte Carlo bootstrap resampling (r = PnL / Initial Investment).
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
              <span>Win Rate: <strong className="text-emerald-600">{formatPercentage(result.winRate)}</strong></span>
              <span>Avg Win: <strong className="text-emerald-600">+{formatPercentage(result.avgWin)}</strong></span>
              <span>Avg Loss: <strong className="text-rose-600">{formatPercentage(result.avgLoss)}</strong></span>
              <span>Profit Factor: <strong className="text-indigo-600">{result.profitFactor.toFixed(2)}</strong></span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-[11px] sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Trade Code</th>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-4 text-right">Initial Outlay</th>
                  <th className="py-3 px-4 text-right">Realized P&L</th>
                  <th className="py-3 px-4 text-right">Return (R-Multiple)</th>
                  <th className="py-3 px-4">Closed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {initialReturns.map((tr, idx) => {
                  const isPositive = tr.returnPct >= 0;
                  return (
                    <tr key={`${tr.tradeCode}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-gray-900">
                        #{tr.tradeCode}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-indigo-600">
                        {tr.symbol}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        {formatCurrency(tr.initialInvestment)}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold ${
                        isPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPositive ? '+' : ''}{formatCurrency(tr.realizedPnl)}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold ${
                        isPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPositive ? '+' : ''}{formatPercentage(tr.returnPct)} ({isPositive ? '+' : ''}{tr.returnPct.toFixed(2)}R)
                      </td>
                      <td className="py-2.5 px-4 text-gray-500">
                        {tr.closedDate ? tr.closedDate.substring(0, 10) : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Strategy & Mathematical Guidance Footer */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl border border-indigo-100/80 p-5 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
          <span>ℹ️</span>
          <span>Quant Methodology: Ralph Vince Optimal f & Stochastic Bootstrap</span>
        </div>
        <p className="leading-relaxed">
          Ralph Vince Optimal f represents the fixed fraction of total portfolio equity that maximizes the expected geometric compounding growth rate under repeated runs. Sizing above Optimal f results in suboptimal returns and a steep exponential escalation of ruin probability. Many quantitative funds trade at fractional Optimal f (such as half-f) to capture most of the peak CAGR while significantly reducing drawdown risks.
        </p>
      </div>
    </div>
  );
}
