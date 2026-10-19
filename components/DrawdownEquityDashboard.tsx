'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts'
import { EquityCurveSummary, EquityCurvePoint } from '../types'
import { formatMoney, formatPct, formatearFecha } from '../lib/formatters'

interface DrawdownEquityDashboardProps {
  initialSummary: EquityCurveSummary
}

export default function DrawdownEquityDashboard({ initialSummary }: DrawdownEquityDashboardProps) {
  const [mounted, setMounted] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [showHwmStep, setShowHwmStep] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  const {
    points,
    currentClosedEquity,
    maxHistoricalPeak,
    maxDrawdownAmount,
    maxDrawdownPct,
    maxUnderwaterTrades,
    maxUnderwaterDays,
    totalClosedTrades
  } = initialSummary

  // Filtrado y paginación para la tabla de historial
  const filteredPoints = useMemo(() => {
    if (!searchQuery.trim()) return points
    const q = searchQuery.trim().toLowerCase()
    return points.filter(
      p =>
        p.symbol.toLowerCase().includes(q) ||
        String(p.trade_code).includes(q) ||
        String(p.index).includes(q)
    )
  }, [points, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredPoints.length / pageSize))
  const paginatedPoints = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredPoints.slice(start, start + pageSize)
  }, [filteredPoints, currentPage, pageSize])

  // Custom tooltip para el gráfico interactivo
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null
    const pt: EquityCurvePoint = payload[0].payload
    const isWin = pt.pnl >= 0

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-4 shadow-2xl text-xs text-white space-y-2 min-w-[240px]">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <span className="font-semibold text-slate-300">
            #{pt.index} &bull; Trade {pt.trade_code}
          </span>
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
            {pt.symbol}
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Closed Date:</span>
            <span className="font-medium text-slate-200">{formatearFecha(pt.closed_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Period:</span>
            <span className="font-medium text-slate-200">{pt.period_days} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Trade P&L:</span>
            <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isWin ? '+' : ''}${formatMoney(pt.pnl)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1.5">
            <span className="text-slate-300 font-medium">Closed Equity:</span>
            <span className="font-bold text-blue-400">${formatMoney(pt.closed_equity)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">High Water Mark:</span>
            <span className="font-medium text-red-400">${formatMoney(pt.running_peak)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Drawdown:</span>
            <span
              className={`font-semibold ${pt.drawdown_amount < 0 ? 'text-rose-400' : 'text-slate-300'}`}
            >
              ${formatMoney(pt.drawdown_amount)} ({formatPct(pt.drawdown_pct * 100)})
            </span>
          </div>
          {pt.is_peak && (
            <div className="mt-2 text-center py-1 rounded bg-red-500/20 text-red-300 font-semibold border border-red-500/30">
              New All-Time High Peak!
            </div>
          )}
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
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Quantitative Analytics
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Equity Curve & Drawdown Peaks
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Continuous cumulative equity growth vs. High Water Mark (HWM) peak crests, tracking
              underwater recovery and historical peak-to-trough drawdowns.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700">
              <input
                type="checkbox"
                checked={showHwmStep}
                onChange={e => setShowHwmStep(e.target.checked)}
                className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
              Show HWM Ceiling Line
            </label>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Closed Equity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Current Closed Equity
          </div>
          <div
            className={`text-2xl sm:text-3xl font-bold mt-2 ${
              currentClosedEquity >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            ${formatMoney(currentClosedEquity)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            Cumulative result across {totalClosedTrades} closed trades
          </div>
        </div>

        {/* Card 2: Peak HWM */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            All-Time Peak (HWM)
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-2 text-slate-900 dark:text-slate-100">
            ${formatMoney(maxHistoricalPeak)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            Highest portfolio equity peak achieved
          </div>
        </div>

        {/* Card 3: Max Drawdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Max Drawdown (Peak to Trough)
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-2 text-rose-600 dark:text-rose-400">
            ${formatMoney(maxDrawdownAmount)}
          </div>
          <div className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-2 font-medium">
            Max relative drop: {formatPct(maxDrawdownPct * 100)}
          </div>
        </div>

        {/* Card 4: Underwater Duration */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Max Underwater Streak
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-2 text-slate-900 dark:text-slate-100">
            {maxUnderwaterTrades} trades
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Longest drawdown duration: {maxUnderwaterDays} days
          </div>
        </div>
      </div>

      {/* CHART CONTAINER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Closed Equity Curve vs. Peaks (HWM)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Solid blue line: Cumulative Closed Equity ($) &bull; Red crests: High Water Mark Peaks
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="w-3 h-0.5 bg-blue-600 dark:bg-blue-400 inline-block" />
              Closed Equity ($)
            </span>
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 dark:bg-red-500 inline-block" />
              Peaks (HWM)
            </span>
          </div>
        </div>

        {totalClosedTrades === 0 ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
              📉
            </div>
            <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">
              No Closed Trades Available
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Closed trade records and realized profits/losses will appear here automatically once
              transactions or statements are processed.
            </p>
          </div>
        ) : mounted ? (
          <div className="w-full h-[460px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={points}
                margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.15}
                  vertical={false}
                />
                <XAxis
                  dataKey="index"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  label={{
                    value: 'Closed Trades Sequence (#)',
                    position: 'insideBottom',
                    offset: -15,
                    fill: '#94a3b8',
                    fontSize: 11
                  }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={val => {
                    if (Math.abs(val) >= 1000) {
                      return `$${(val / 1000).toFixed(0)}k`
                    }
                    return `$${val}`
                  }}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  iconSize={10}
                  wrapperStyle={{ fontSize: '12px' }}
                />

                {/* HWM step ceiling line */}
                {showHwmStep && (
                  <Line
                    type="stepAfter"
                    dataKey="running_peak"
                    name="HWM Ceiling ($)"
                    stroke="#f87171"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                {/* Main Equity Curve */}
                <Line
                  type="monotone"
                  dataKey="closed_equity"
                  name="Closed Equity ($)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                />

                {/* Peaks (null if not a peak, creating discrete red markers on all-time highs) */}
                <Line
                  type="monotone"
                  dataKey="peak"
                  name="Peaks (New Highs)"
                  stroke="#dc2626"
                  strokeWidth={0}
                  connectNulls={false}
                  dot={{
                    r: 4.5,
                    fill: '#dc2626',
                    stroke: '#ffffff',
                    strokeWidth: 1.5
                  }}
                  activeDot={{ r: 7, fill: '#ef4444' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-[460px] flex items-center justify-center text-slate-400 text-sm">
            Loading interactive chart...
          </div>
        )}
      </div>

      {/* COLLAPSIBLE CLOSED TRADES HISTORY TABLE */}
      {totalClosedTrades > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Closed Trades Performance Log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed ledger with ordinal index, trade codes, hold periods, P&L, cumulative
                equity, and drawdowns.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowTable(!showTable)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"
              >
                {showTable ? 'Hide Table' : `Show Table (${filteredPoints.length} Trades)`}
                <span className="text-xs">{showTable ? '▲' : '▼'}</span>
              </button>
            </div>
          </div>

          {showTable && (
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="Search symbol or trade code..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Show per page:</span>
                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Closed Date</th>
                      <th className="py-2.5 px-3 text-right">Period</th>
                      <th className="py-2.5 px-3 text-right">P&L (Trade)</th>
                      <th className="py-2.5 px-3 text-right">Closed Equity</th>
                      <th className="py-2.5 px-3 text-right">Peak (HWM)</th>
                      <th className="py-2.5 px-3 text-right">Drawdown ($)</th>
                      <th className="py-2.5 px-3 text-right">Drawdown (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {paginatedPoints.map(pt => {
                      const isWin = pt.pnl >= 0
                      return (
                        <tr
                          key={pt.index}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                            pt.is_peak ? 'bg-red-50/30 dark:bg-red-950/20' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-sans text-slate-400">{pt.index}</td>
                          <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
                            {pt.trade_code}
                          </td>
                          <td className="py-2 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">
                            {pt.symbol}
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-sans">
                            {formatearFecha(pt.closed_date)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                            {pt.period_days} d
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              isWin
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isWin ? '+' : ''}${formatMoney(pt.pnl)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                            ${formatMoney(pt.closed_equity)}
                          </td>
                          <td className="py-2 px-3 text-right text-red-600 dark:text-red-400">
                            {pt.peak !== null ? (
                              <span className="font-bold underline decoration-red-400">
                                ${formatMoney(pt.peak)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-sans">-</span>
                            )}
                          </td>
                          <td
                            className={`py-2 px-3 text-right ${
                              pt.drawdown_amount < 0
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            ${formatMoney(pt.drawdown_amount)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right ${
                              pt.drawdown_pct < 0
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatPct(pt.drawdown_pct * 100)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>
                  Showing {filteredPoints.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, filteredPoints.length)} of{' '}
                  {filteredPoints.length} trades
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
