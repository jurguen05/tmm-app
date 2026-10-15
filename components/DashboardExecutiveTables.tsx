'use client'

import React, { useState, useMemo } from 'react'
import {
  ExecutiveDashboardData,
  Position,
  Transaction,
  Strategy,
  Trade
} from '../types'
import { calcularAssetAllocation, EXCLUDED_STRATEGIES } from '../lib/dashboardStatsCalculator'

interface DashboardExecutiveTablesProps {
  initialData: ExecutiveDashboardData
  positions: Position[]
  strategies: Strategy[]
  trades: Trade[]
  transactions: Transaction[]
}

/** Formateador de moneda con separador de miles sin símbolo $: 1.234,56 o -1.234,56 */
export const formatMoney = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '0,00'
  const isNeg = val < 0
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(val))
  return isNeg ? `-${formatted}` : formatted
}

/** Formateador de porcentaje: 12,34% */
export const formatPct = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '0,00%'
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val)
  return `${formatted}%`
}

/** Formateador de múltiplos R: +0,35 R o -0,20 R */
export const formatR = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '0,00 R'
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val)
  return val > 0 ? `+${formatted} R` : `${formatted} R`
}

/** Formateador de ratios numéricos simples: 2,15 */
export const formatRatio = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '0,00'
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val)
}

/** Parsea un string en formato es-AR (17.379,61) a número float estándar */
export const parseNumberEsAR = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  let str = String(val).trim()
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  }
  const clean = str.replace(/[^0-9.-]+/g, '')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

/** Formateador con separadores de miles para inputs en formato es-AR (ej: 17.379,61) */
const formatThousands = (val: number | string): string => {
  if (val === '' || val === null || val === undefined) return '0,00'
  const num = typeof val === 'number' ? val : parseNumberEsAR(val)
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

export default function DashboardExecutiveTables({
  initialData,
  positions,
  strategies,
  trades,
  transactions
}: DashboardExecutiveTablesProps) {
  // Estado local para permitir ajustar el saldo en efectivo de la cartera (Cash Balance)
  // Inicializado con formato de miles a partir del valor de 'Cash & Sweep Vehicle' (ej: 17.379,61)
  const detectedCash = initialData.assetAllocation.totalCashBalance
  const [cashBalanceInput, setCashBalanceInput] = useState<string>(() => {
    return detectedCash > 0 ? formatThousands(detectedCash) : '0,00'
  })
  const [activeTab, setActiveTab] = useState<'all' | 'allocation' | 'pnl' | 'audit' | 'risk'>('all')

  // Recalcular Asset Allocation si el usuario ajusta el Cash Balance
  const assetAllocation = useMemo(() => {
    const cashVal = parseNumberEsAR(cashBalanceInput)
    return calcularAssetAllocation(positions, strategies, trades, transactions, cashVal)
  }, [cashBalanceInput, positions, strategies, trades, transactions])

  const { strategyPnL, auditMetrics, riskMultiples } = initialData

  return (
    <div className="space-y-8">
      {/* SECCIÓN CABECERA DEL CENTRO DE CONTROL EJECUTIVO */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold tracking-wide uppercase mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Executive Control Center
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Executive Control Center</h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Real-time portfolio analytics, strategic asset allocation, audited performance metrics, and risk multiples.
            </p>
          </div>

          {/* Portfolio Cash Balance Input con formato de miles (17.379,61) sin símbolo $ */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div>
              <label htmlFor="cash-input" className="block text-xs font-semibold text-white tracking-wide">
                Portfolio Cash Balance
              </label>
            </div>
            <div className="relative">
              <input
                id="cash-input"
                type="text"
                value={cashBalanceInput}
                onChange={(e) => setCashBalanceInput(e.target.value)}
                onBlur={() => {
                  const val = parseNumberEsAR(cashBalanceInput)
                  setCashBalanceInput(formatThousands(val))
                }}
                placeholder="0,00"
                className="w-40 px-3 py-1.5 text-sm font-semibold font-mono bg-white/20 text-white placeholder-slate-400 rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/30 transition-all text-right"
              />
            </div>
          </div>
        </div>


        {/* Executive Tab Filter Bar */}
        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            All Executive Tables (4)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'allocation'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            1. Asset Allocation & Balance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pnl')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'pnl'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            2. Strategy P&L
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'audit'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            3. Audit Metrics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('risk')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'risk'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            4. Risk & R-Multiples
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ASSET ALLOCATION & PORTFOLIO BALANCE */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'allocation') && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden transition-all">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <h3 className="text-lg font-bold text-gray-900">Asset Allocation & Portfolio Balance</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Net Liquidation Value classified by instrument (Stocks, Calls, Puts & Cash) across active strategies.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs">
                <span className="text-gray-500">Total Portfolio: </span>
                <span className="font-bold text-indigo-900">{formatMoney(assetAllocation.totalPortfolioValue)}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold text-gray-800">Strategy</th>
                  <th className="py-3.5 px-4 text-right">Stock Value</th>
                  <th className="py-3.5 px-4 text-right">CALL Value</th>
                  <th className="py-3.5 px-4 text-right">PUT Value</th>
                  <th className="py-3.5 px-4 text-right">Cash Balance</th>
                  <th className="py-3.5 px-4 text-right font-bold text-gray-800">Portfolio Value</th>
                  <th className="py-3.5 px-4 text-right font-bold text-indigo-700">% Allocation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assetAllocation.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">
                      No positions recorded in the portfolio.
                    </td>
                  </tr>
                ) : (
                  assetAllocation.rows.map((row) => (
                    <tr key={row.strategy} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        {row.strategy}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-700">
                        {row.stockValue !== 0 ? formatMoney(row.stockValue) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-700">
                        {row.callValue !== 0 ? formatMoney(row.callValue) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-700">
                        {row.putValue !== 0 ? formatMoney(row.putValue) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-400">
                        <span className="text-gray-300">-</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">
                        {formatMoney(row.portfolioValue)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600">
                        {formatPct(row.allocationPct)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* FILA DE TOTALES Y FILA PORCENTUAL */}
              <tfoot className="border-t-2 border-gray-300 bg-gray-50/90 font-bold text-gray-900">
                {/* 1. Totales de Cartera ($) */}
                <tr className="border-b border-gray-200">
                  <td className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider text-gray-900">
                    Total Portfolio
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-gray-900">
                    {formatMoney(assetAllocation.totalStockValue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-gray-900">
                    {formatMoney(assetAllocation.totalCallValue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-gray-900">
                    {formatMoney(assetAllocation.totalPutValue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">
                    {formatMoney(assetAllocation.totalCashBalance)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-indigo-950 text-base">
                    {formatMoney(assetAllocation.totalPortfolioValue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-indigo-700">
                    100,00%
                  </td>
                </tr>

                {/* 2. Fila Porcentual (% de acciones, % de calls, % de puts, % de cash) */}
                <tr className="bg-indigo-50/60 text-xs text-indigo-950">
                  <td className="py-3 px-4 font-bold uppercase tracking-wider text-indigo-800">
                    % Portfolio Share
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-900">
                    {formatPct(assetAllocation.stockPct)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-900">
                    {formatPct(assetAllocation.callPct)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-900">
                    {formatPct(assetAllocation.putPct)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-800">
                    {formatPct(assetAllocation.cashPct)}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-indigo-950">
                    100,00%
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-600">
                    -
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TABLA DE P&L POR ESTRATEGIA (Closed P&L vs Open P&L) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'pnl') && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden transition-all">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <h3 className="text-lg font-bold text-gray-900">Strategy P&L (Closed vs Open)</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Realized cumulative P&L of closed trades vs current mark-to-market Open P&L.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium" title={EXCLUDED_STRATEGIES.join(', ')}>
                <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                5 Non-core Strategies Excluded
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold text-gray-800">Strategy</th>
                  <th className="py-3.5 px-4 text-right">Closed P&L</th>
                  <th className="py-3.5 px-4 text-right">Open P&L</th>
                  <th className="py-3.5 px-4 text-right font-bold text-gray-800">Total P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {strategyPnL.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                      No eligible trades or strategy P&L records available.
                    </td>
                  </tr>
                ) : (
                  strategyPnL.rows.map((row) => {
                    const isTotalPos = row.totalPnL > 0
                    const isTotalNeg = row.totalPnL < 0
                    return (
                      <tr key={row.strategy} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isTotalPos ? 'bg-emerald-500' : isTotalNeg ? 'bg-rose-500' : 'bg-gray-400'}`} />
                          {row.strategy}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${row.closedPnL > 0 ? 'text-emerald-600' : row.closedPnL < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                          {formatMoney(row.closedPnL)}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${row.openPnL > 0 ? 'text-emerald-600' : row.openPnL < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                          {formatMoney(row.openPnL)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isTotalPos
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isTotalNeg
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {formatMoney(row.totalPnL)}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50/90 font-bold text-gray-900">
                <tr>
                  <td className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider text-gray-900">
                    Total Strategic P&L
                  </td>
                  <td className={`py-3.5 px-4 text-right font-extrabold ${strategyPnL.totalClosedPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatMoney(strategyPnL.totalClosedPnL)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-extrabold ${strategyPnL.totalOpenPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatMoney(strategyPnL.totalOpenPnL)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`inline-block px-3 py-1 rounded-xl text-sm font-extrabold ${
                      strategyPnL.grandTotalPnL >= 0
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {formatMoney(strategyPnL.grandTotalPnL)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TABLA DE MÉTRICAS ESTADÍSTICAS DE RENDIMIENTO (Audit Metrics) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'audit') && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden transition-all">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <h3 className="text-lg font-bold text-gray-900">Performance & Audit Metrics</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Audited win rate, win/loss ratio, average trades, and mathematical expectancy across trade lifecycles.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                Overall Evaluated: {auditMetrics.overall.quantity} Trades
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold text-gray-800">Metric</th>
                  <th className="py-3.5 px-4 text-right font-semibold text-gray-700">Closed Trades</th>
                  <th className="py-3.5 px-4 text-right font-semibold text-gray-700">Open Trades</th>
                  <th className="py-3.5 px-4 text-right font-bold text-indigo-900 bg-indigo-50/40">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Average Winner */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Average Winner
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-600">
                    {formatMoney(auditMetrics.closed.averageWinner)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-600">
                    {formatMoney(auditMetrics.open.averageWinner)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-700 bg-indigo-50/20">
                    {formatMoney(auditMetrics.overall.averageWinner)}
                  </td>
                </tr>

                {/* Average Loser */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Average Loser
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-rose-600">
                    {formatMoney(auditMetrics.closed.averageLoser)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-rose-600">
                    {formatMoney(auditMetrics.open.averageLoser)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-rose-700 bg-indigo-50/20">
                    {formatMoney(auditMetrics.overall.averageLoser)}
                  </td>
                </tr>

                {/* Win/Loss Ratio */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Win/Loss Ratio
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-800">
                    {formatRatio(auditMetrics.closed.winLossRatio)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-800">
                    {formatRatio(auditMetrics.open.winLossRatio)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-900 bg-indigo-50/20">
                    {formatRatio(auditMetrics.overall.winLossRatio)}
                  </td>
                </tr>

                {/* Win Rate % */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Win Rate %
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    {formatPct(auditMetrics.closed.winRatePct)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    {formatPct(auditMetrics.open.winRatePct)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-900 bg-indigo-50/20">
                    {formatPct(auditMetrics.overall.winRatePct)}
                  </td>
                </tr>

                {/* Expectancy */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    Expectancy
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                      auditMetrics.closed.expectancy >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {formatRatio(auditMetrics.closed.expectancy)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                      auditMetrics.open.expectancy >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {formatRatio(auditMetrics.open.expectancy)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right bg-indigo-50/20">
                    <span className={`inline-block px-2.5 py-0.5 rounded font-extrabold text-xs ${
                      auditMetrics.overall.expectancy >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {formatRatio(auditMetrics.overall.expectancy)}
                    </span>
                  </td>
                </tr>

                {/* Quantity */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Quantity (Trades)
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-700">
                    {auditMetrics.closed.quantity}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-700">
                    {auditMetrics.open.quantity}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900 bg-indigo-50/20">
                    {auditMetrics.overall.quantity}
                  </td>
                </tr>

                {/* Net P&L */}
                <tr className="bg-slate-50/50 hover:bg-slate-100/60 font-bold transition-colors">
                  <td className="py-3.5 px-4 font-extrabold text-gray-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    Net Accumulated P&L
                  </td>
                  <td className={`py-3.5 px-4 text-right ${auditMetrics.closed.totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatMoney(auditMetrics.closed.totalPnL)}
                  </td>
                  <td className={`py-3.5 px-4 text-right ${auditMetrics.open.totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatMoney(auditMetrics.open.totalPnL)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-extrabold text-base bg-indigo-50/40 ${
                    auditMetrics.overall.totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {formatMoney(auditMetrics.overall.totalPnL)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TABLA DE RIESGO & MÚLTIPLOS R (Risk Strategies - Trades Cerrados) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'risk') && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden transition-all">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <h3 className="text-lg font-bold text-gray-900">Risk & R-Multiples (Closed Trades)</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Strategy profitability benchmarked against initial purchase capital outlay (R = Total P&L / Initial Investment).
              </p>
            </div>
          </div>

          {/* KPI CARDS DESTACADOS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 bg-slate-50/40 border-b border-gray-100">
            {/* Closed Trades */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Closed Trades</span>
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{riskMultiples.closedTradesCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                📋
              </div>
            </div>

            {/* Inversión Inicial Promedio */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Avg Initial Investment</span>
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{formatMoney(riskMultiples.averageInitialInvestment)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                💵
              </div>
            </div>

            {/* Portfolio R */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Portfolio Global R</span>
                <p className={`text-2xl font-extrabold mt-0.5 ${
                  riskMultiples.portfolioR >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {formatR(riskMultiples.portfolioR)}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                riskMultiples.portfolioR >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                🎯
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold text-gray-800">Strategy</th>
                  <th className="py-3.5 px-4 text-right">Total P&L</th>
                  <th className="py-3.5 px-4 text-right">Initial Investment</th>
                  <th className="py-3.5 px-4 text-right font-bold text-purple-900">R Multiple</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {riskMultiples.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                      No closed trades found to evaluate risk multiples.
                    </td>
                  </tr>
                ) : (
                  riskMultiples.rows.map((row) => {
                    const isPos = row.totalPnL > 0
                    const isNeg = row.totalPnL < 0
                    return (
                      <tr key={row.strategy} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isPos ? 'bg-emerald-500' : isNeg ? 'bg-rose-500' : 'bg-gray-400'}`} />
                          {row.strategy}
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${isPos ? 'text-emerald-600' : isNeg ? 'text-rose-600' : 'text-gray-500'}`}>
                          {formatMoney(row.totalPnL)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-700">
                          {formatMoney(row.initialInvestment)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                            row.rMultiple > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : row.rMultiple < 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {formatR(row.rMultiple)}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50/90 font-bold text-gray-900">
                <tr>
                  <td className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider text-gray-900">
                    Total / Portfolio
                  </td>
                  <td className={`py-3.5 px-4 text-right font-extrabold ${riskMultiples.totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatMoney(riskMultiples.totalPnL)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-gray-900">
                    {formatMoney(riskMultiples.totalInitialInvestment)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`inline-block px-3 py-1 rounded-xl text-sm font-extrabold ${
                      riskMultiples.portfolioR >= 0
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {formatR(riskMultiples.portfolioR)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
