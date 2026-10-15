'use client'

import React, { useState } from 'react'
import {
  ExecutiveDashboardData,
  Position,
  Transaction,
  Strategy,
  Trade
} from '../types'
import { EXCLUDED_STRATEGIES } from '../lib/dashboardStatsCalculator'

interface DashboardExecutiveTablesProps {
  initialData: ExecutiveDashboardData
  positions: Position[]
  strategies: Strategy[]
  trades: Trade[]
  transactions: Transaction[]
}

/** Formateador de moneda con 2 decimales y separador de miles: 1.234,56 o -1.234,56 */
export const formatMoney = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '0,00'
  const isNeg = val < 0
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(val))
  return isNeg ? `-${formatted}` : formatted
}

/** Formateador de moneda/número entero con separador de miles sin decimales: 17.380 o -1.235 */
export const formatIntegerMoney = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '0'
  const isNeg = val < 0
  const rounded = Math.round(Math.abs(val))
  const formatted = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0
  }).format(rounded)
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

/** Parsea un string en formato es-AR (17.379,61 o 17.380) a número float estándar */
export const parseNumberEsAR = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  let str = String(val).trim()
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  } else if (str.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '')
    }
  }
  const clean = str.replace(/[^0-9.-]+/g, '')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

/** Formateador entero con separadores de miles para formato es-AR sin decimales (ej: 17.380) */
const formatThousands = (val: number | string): string => {
  if (val === '' || val === null || val === undefined) return '0'
  const num = typeof val === 'number' ? val : parseNumberEsAR(val)
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0
  }).format(Math.round(num))
}

export default function DashboardExecutiveTables({
  initialData,
  positions,
  strategies,
  trades,
  transactions
}: DashboardExecutiveTablesProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'allocation' | 'pnl' | 'audit' | 'risk'>('all')
  const { assetAllocation, strategyPnL, auditMetrics, riskMultiples } = initialData

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
                <span className="font-bold text-indigo-900">{formatIntegerMoney(assetAllocation.totalPortfolioValue)}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold text-gray-800">Strategy</th>
                  <th className="py-3.5 px-4 text-center">Stock Value</th>
                  <th className="py-3.5 px-4 text-center">CALL Value</th>
                  <th className="py-3.5 px-4 text-center">PUT Value</th>
                  <th className="py-3.5 px-4 text-center">Cash Balance</th>
                  <th className="py-3.5 pl-4 pr-1 text-center font-bold text-gray-800">Portfolio Value</th>
                  <th className="py-3.5 pl-1 pr-4 w-20"></th>
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
                  <>
                    {assetAllocation.rows.map((row) => (
                      <tr key={row.strategy} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          {row.strategy}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-700 tabular-nums">
                          {row.stockValue !== 0 ? formatIntegerMoney(row.stockValue) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-700 tabular-nums">
                          {row.callValue !== 0 ? formatIntegerMoney(row.callValue) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-gray-700 tabular-nums">
                          {row.putValue !== 0 ? formatIntegerMoney(row.putValue) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-300">-</td>
                        <td className="py-3 pl-4 pr-1 text-center font-bold text-gray-900 tabular-nums">
                          {formatIntegerMoney(row.portfolioValue)}
                        </td>
                        <td className="py-3 pl-1 pr-4 text-left font-bold text-indigo-600 text-sm whitespace-nowrap">
                          ({formatPct(row.allocationPct)})
                        </td>
                      </tr>
                    ))}

                    {/* Fila de Cash Balance */}
                    <tr className="hover:bg-slate-50/80 transition-colors bg-emerald-50/20">
                      <td className="py-3 px-4 font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Cash Balance
                      </td>
                      <td className="py-3 px-4 text-center text-gray-300">-</td>
                      <td className="py-3 px-4 text-center text-gray-300">-</td>
                      <td className="py-3 px-4 text-center text-gray-300">-</td>
                      <td className="py-3 px-4 text-center font-medium text-emerald-700 tabular-nums">
                        {formatIntegerMoney(assetAllocation.totalCashBalance)}
                      </td>
                      <td className="py-3 pl-4 pr-1 text-center font-bold text-gray-900 tabular-nums">
                        {formatIntegerMoney(assetAllocation.totalCashBalance)}
                      </td>
                      <td className="py-3 pl-1 pr-4 text-left font-bold text-indigo-600 text-sm whitespace-nowrap">
                        ({formatPct(assetAllocation.cashPct)})
                      </td>
                    </tr>
                  </>
                )}
              </tbody>

              {/* FILA DE TOTALES CON PORCENTAJE DEBAJO DEL MONTO */}
              <tfoot className="border-t-2 border-gray-300 bg-gray-50/90 font-bold text-gray-900">
                <tr className="border-b border-gray-200">
                  <td className="py-4 px-4 text-xs font-extrabold uppercase tracking-wider text-gray-900 align-top">
                    Total Portfolio
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="font-extrabold text-sm text-gray-900 tabular-nums">
                      {formatIntegerMoney(assetAllocation.totalStockValue)}
                    </div>
                    <div className="mt-1 flex justify-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {formatPct(assetAllocation.stockPct)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="font-extrabold text-sm text-gray-900 tabular-nums">
                      {formatIntegerMoney(assetAllocation.totalCallValue)}
                    </div>
                    <div className="mt-1 flex justify-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {formatPct(assetAllocation.callPct)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="font-extrabold text-sm text-gray-900 tabular-nums">
                      {formatIntegerMoney(assetAllocation.totalPutValue)}
                    </div>
                    <div className="mt-1 flex justify-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {formatPct(assetAllocation.putPct)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="font-extrabold text-sm text-emerald-700 tabular-nums">
                      {formatIntegerMoney(assetAllocation.totalCashBalance)}
                    </div>
                    <div className="mt-1 flex justify-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {formatPct(assetAllocation.cashPct)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pl-4 pr-1 text-center align-top">
                    <div className="font-extrabold text-base text-indigo-950 tabular-nums pt-0.5">
                      {formatIntegerMoney(assetAllocation.totalPortfolioValue)}
                    </div>
                  </td>
                  <td className="py-3 pl-1 pr-4"></td>
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium" title="Hedge is isolated as portfolio protection">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Hedge
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
                          {formatIntegerMoney(row.closedPnL)}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${row.openPnL > 0 ? 'text-emerald-600' : row.openPnL < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                          {formatIntegerMoney(row.openPnL)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isTotalPos
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isTotalNeg
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {formatIntegerMoney(row.totalPnL)}
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
                    {formatIntegerMoney(strategyPnL.totalClosedPnL)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-extrabold ${strategyPnL.totalOpenPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatIntegerMoney(strategyPnL.totalOpenPnL)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`inline-block px-3 py-1 rounded-xl text-sm font-extrabold ${
                      strategyPnL.grandTotalPnL >= 0
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {formatIntegerMoney(strategyPnL.grandTotalPnL)}
                    </span>
                  </td>
                </tr>
                {/* HEDGE (PORTFOLIO PROTECTION) */}
                {strategyPnL.hedge && (strategyPnL.hedge.closedPnL !== 0 || strategyPnL.hedge.openPnL !== 0) && (
                  <tr className="border-t border-amber-200/80 bg-amber-50/70 font-semibold text-gray-800">
                    <td className="py-2.5 px-4 text-xs font-bold text-amber-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Hedge (Portfolio Protection)
                    </td>
                    <td className={`py-2.5 px-4 text-right font-medium ${strategyPnL.hedge.closedPnL > 0 ? 'text-emerald-600' : strategyPnL.hedge.closedPnL < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                      {formatIntegerMoney(strategyPnL.hedge.closedPnL)}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-medium ${strategyPnL.hedge.openPnL > 0 ? 'text-emerald-600' : strategyPnL.hedge.openPnL < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                      {formatIntegerMoney(strategyPnL.hedge.openPnL)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                        strategyPnL.hedge.totalPnL > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : strategyPnL.hedge.totalPnL < 0
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {formatIntegerMoney(strategyPnL.hedge.totalPnL)}
                      </span>
                    </td>
                  </tr>
                )}
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
                    {formatIntegerMoney(auditMetrics.closed.averageWinner)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-600">
                    {formatIntegerMoney(auditMetrics.open.averageWinner)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-700 bg-indigo-50/20">
                    {formatIntegerMoney(auditMetrics.overall.averageWinner)}
                  </td>
                </tr>

                {/* Average Loser */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Average Loser
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-rose-600">
                    {formatIntegerMoney(auditMetrics.closed.averageLoser)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-rose-600">
                    {formatIntegerMoney(auditMetrics.open.averageLoser)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-rose-700 bg-indigo-50/20">
                    {formatIntegerMoney(auditMetrics.overall.averageLoser)}
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
                    {formatIntegerMoney(auditMetrics.closed.totalPnL)}
                  </td>
                  <td className={`py-3.5 px-4 text-right ${auditMetrics.open.totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatIntegerMoney(auditMetrics.open.totalPnL)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-extrabold text-base bg-indigo-50/40 ${
                    auditMetrics.overall.totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {formatIntegerMoney(auditMetrics.overall.totalPnL)}
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
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{formatIntegerMoney(riskMultiples.averageInitialInvestment)}</p>
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
                          {formatIntegerMoney(row.totalPnL)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-700">
                          {formatIntegerMoney(row.initialInvestment)}
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
                    {formatIntegerMoney(riskMultiples.totalPnL)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-gray-900">
                    {formatIntegerMoney(riskMultiples.totalInitialInvestment)}
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
