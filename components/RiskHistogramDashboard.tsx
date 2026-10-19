'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts'
import { HistogramResult, HistogramBin, Trade } from '../types'
import { formatMoney, formatPct } from '../lib/formatters'
import { calculatePnLHistogram } from '../lib/histogramCalculator'

interface RiskHistogramDashboardProps {
  initialTrades: Trade[]
  initialResult: HistogramResult
}

export default function RiskHistogramDashboard({
  initialTrades,
  initialResult
}: RiskHistogramDashboardProps) {
  const [mounted, setMounted] = useState(false)
  const [binCount, setBinCount] = useState(30)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Recalcular dinámicamente si el usuario cambia la cantidad de bins
  const histogramData: HistogramResult = useMemo(() => {
    if (binCount === 30) return initialResult
    return calculatePnLHistogram(initialTrades, binCount)
  }, [initialTrades, binCount, initialResult])

  const { min, max, mean, n, bins } = histogramData

  // Calcular métricas complementarias (Win rate, ganadores vs perdedores)
  const extraStats = useMemo(() => {
    let winners = 0
    let losers = 0
    let winSum = 0
    let lossSum = 0

    for (const t of initialTrades) {
      if ((t.status || '').toLowerCase() === 'closed') {
        const val =
          t.realized_pnl !== null && t.realized_pnl !== undefined
            ? Number(t.realized_pnl)
            : t.cash_flow !== null && t.cash_flow !== undefined
            ? Number(t.cash_flow)
            : 0
        if (val > 0) {
          winners++
          winSum += val
        } else if (val < 0) {
          losers++
          lossSum += val
        }
      }
    }

    const winRate = n > 0 ? (winners / n) * 100 : 0
    const avgWin = winners > 0 ? winSum / winners : 0
    const avgLoss = losers > 0 ? lossSum / losers : 0

    return {
      winners,
      losers,
      winRate,
      avgWin,
      avgLoss
    }
  }, [initialTrades, n])

  // Custom tooltip dual-axis para el histograma
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null
    const bin: HistogramBin = payload[0].payload

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-4 shadow-2xl text-xs text-white space-y-2 min-w-[250px]">
        <div className="border-b border-slate-700 pb-2">
          <span className="text-slate-400 font-medium">P&L Range:</span>
          <div className="text-sm font-bold text-slate-100 font-mono mt-0.5">
            ${formatMoney(bin.binLower)} to ${formatMoney(bin.binUpper)}
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-blue-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-blue-500 inline-block" />
              Frequency (f):
            </span>
            <span className="font-bold text-slate-100 text-sm">{bin.f} trades</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Relative Frequency (rfd):</span>
            <span className="font-medium text-slate-200">
              {formatPct(bin.rfd * 100)}
            </span>
          </div>

          <div className="flex justify-between items-center border-t border-slate-800 pt-1.5">
            <span className="text-red-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Cumulative (CRF):
            </span>
            <span className="font-bold text-red-400 text-sm">
              {formatPct(bin.crf * 100)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold tracking-wide uppercase mb-3">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              Statistical Risk Analysis
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              P&L Distribution & CRF Curve
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Homogeneous histogram binning of realized P&L outcomes combined with cumulative
              relative frequency (CRF) sigmoid progression.
            </p>
          </div>

          {/* Bin granularity control */}
          <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700/80">
            <span className="text-xs text-slate-300 font-medium">Bins:</span>
            <div className="flex items-center gap-1.5">
              {[20, 25, 30, 35].map(b => (
                <button
                  key={b}
                  onClick={() => setBinCount(b)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    binCount === b
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Min P&L (Worst Trade) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Min P&L (Worst Trade)
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-2 text-rose-600 dark:text-rose-400">
            ${formatMoney(min)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Average loser: -${formatMoney(Math.abs(extraStats.avgLoss))}
          </div>
        </div>

        {/* Card 2: Max P&L (Best Trade) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Max P&L (Best Trade)
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
            +${formatMoney(max)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Average winner: +${formatMoney(extraStats.avgWin)}
          </div>
        </div>

        {/* Card 3: Mean P&L */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Mean P&L (Per Trade)
          </div>
          <div
            className={`text-2xl sm:text-3xl font-bold mt-2 ${
              mean >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {mean >= 0 ? '+' : ''}${formatMoney(mean)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Mathematical expectancy per closed operation
          </div>
        </div>

        {/* Card 4: Total Trades (N) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Closed Trades (N)
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-2 text-slate-900 dark:text-slate-100">
            {n}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Win Rate: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatPct(extraStats.winRate)}</span> ({extraStats.winners}W / {extraStats.losers}L)
          </div>
        </div>
      </div>

      {/* DUAL-AXIS CHART CONTAINER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Histogram of Realized P&L & Cumulative Frequency
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Left Y-Axis (Blue Bars): Absolute trade count f &bull; Right Y-Axis (Red Line):
              Cumulative relative frequency (CRF 0% to 100%)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="w-3 h-3 rounded bg-blue-600 dark:bg-blue-500 inline-block" />
              Frequency f (Trades)
            </span>
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <span className="w-3 h-0.5 bg-red-600 dark:bg-red-500 inline-block" />
              Cumulative Frequency (CRF)
            </span>
          </div>
        </div>

        {n === 0 ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
              📊
            </div>
            <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">
              No Trades to Analyze
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              The P&L distribution histogram and cumulative frequency curve will be computed
              automatically once closed trades are loaded.
            </p>
          </div>
        ) : mounted ? (
          <div className="w-full h-[460px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={bins}
                margin={{ top: 20, right: 35, left: 15, bottom: 45 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.15}
                  vertical={false}
                />
                <XAxis
                  dataKey="binLabel"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  interval={Math.max(0, Math.floor(bins.length / 12))}
                  height={50}
                />

                {/* Left Axis: Frequency f */}
                <YAxis
                  yAxisId="left"
                  stroke="#3b82f6"
                  fontSize={11}
                  tickLine={false}
                  allowDecimals={false}
                  label={{
                    value: 'Frequency (f)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#3b82f6',
                    fontSize: 11,
                    offset: 0
                  }}
                />

                {/* Right Axis: Cumulative Relative Frequency (CRF) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#dc2626"
                  fontSize={11}
                  tickLine={false}
                  domain={[0, 1]}
                  tickFormatter={val => `${Math.round(val * 100)}%`}
                  label={{
                    value: 'Cumulative (CRF)',
                    angle: 90,
                    position: 'insideRight',
                    fill: '#dc2626',
                    fontSize: 11,
                    offset: 10
                  }}
                />

                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  iconSize={10}
                  wrapperStyle={{ fontSize: '12px' }}
                />

                {/* Blue Frequency Bars */}
                <Bar
                  yAxisId="left"
                  dataKey="f"
                  name="Frequency f (Trades)"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                />

                {/* Red Continuous CRF Line */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="crf"
                  name="Cumulative Frequency (CRF)"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#dc2626', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-[460px] flex items-center justify-center text-slate-400 text-sm">
            Loading histogram...
          </div>
        )}
      </div>

      {/* COLLAPSIBLE FREQUENCY TABLE */}
      {n > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                P&L Bin Frequency Table
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Discrete classification buckets, absolute counts (f), relative frequency density (rfd), and cumulative progression (crf).
              </p>
            </div>
            <button
              onClick={() => setShowTable(!showTable)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 self-start sm:self-auto"
            >
              {showTable ? 'Hide Table' : `Show Table (${bins.length} Bins)`}
              <span className="text-xs">{showTable ? '▲' : '▼'}</span>
            </button>
          </div>

          {showTable && (
            <div className="p-5 space-y-4">
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3">Bin #</th>
                      <th className="py-2.5 px-3">Lower Bound</th>
                      <th className="py-2.5 px-3">Upper Bound</th>
                      <th className="py-2.5 px-3 text-right">Frequency (f)</th>
                      <th className="py-2.5 px-3 text-right">Relative (rfd %)</th>
                      <th className="py-2.5 px-3 text-right">Cumulative (crf %)</th>
                      <th className="py-2.5 px-3 w-40">CRF Distribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {bins.map(bin => {
                      const isPositive = bin.binMid >= 0
                      return (
                        <tr
                          key={bin.binIndex}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2 px-3 font-sans text-slate-400">{bin.binIndex + 1}</td>
                          <td
                            className={`py-2 px-3 ${
                              bin.binLower >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            ${formatMoney(bin.binLower)}
                          </td>
                          <td
                            className={`py-2 px-3 ${
                              bin.binUpper >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            ${formatMoney(bin.binUpper)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-slate-100 font-sans">
                            {bin.f}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                            {formatPct(bin.rfd * 100)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-red-600 dark:text-red-400">
                            {formatPct(bin.crf * 100)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.round(bin.crf * 100))}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
