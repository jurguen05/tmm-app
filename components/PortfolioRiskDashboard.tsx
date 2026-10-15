'use client'

import React, { useState, useMemo } from 'react'
import {
  PortfolioRiskResult,
  PositionRiskItem,
  StrategyRiskSummary,
  MarketDropLevel
} from '../types'

interface PortfolioRiskDashboardProps {
  initialData: PortfolioRiskResult
}

/** Formateador de moneda: $ 1.234,56 o -$ 1.234,56 */
const formatMoney = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '$ 0.00'
  const isNeg = val < 0
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(val))
  return isNeg ? `-$ ${formatted}` : `$ ${formatted}`
}

/** Formateador de porcentaje: 12.34% */
const formatPct = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '0.00%'
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val * 100)
  return `${formatted}%`
}

/** Badge de colores por estrategia */
const getStrategyBadgeClass = (strategy: string): string => {
  const norm = strategy.toLowerCase().trim()
  if (norm.includes('yearly')) return 'bg-blue-50 text-blue-700 border-blue-200'
  if (norm.includes('100-day') || norm.includes('100 day')) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (norm.includes('flipper')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (norm.includes('mac')) return 'bg-rose-50 text-rose-700 border-rose-200'
  if (norm.includes('pilot')) return 'bg-purple-50 text-purple-700 border-purple-200'
  if (norm.includes('bbo')) return 'bg-cyan-50 text-cyan-700 border-cyan-200'
  if (norm.includes('weekend')) return 'bg-pink-50 text-pink-700 border-pink-200'
  if (norm.includes('tech')) return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  if (norm.includes('hedge')) return 'bg-violet-50 text-violet-700 border-violet-200'
  return 'bg-gray-50 text-gray-700 border-gray-200'
}

type SortField = 'trade_code' | 'symbol' | 'strategy' | 'currentPrice' | 'stopPrice' | 'distancePct' | 'positionAmount' | 'scenarioLoss' | 'pctOfStrategy'
type SortDir = 'asc' | 'desc'

export default function PortfolioRiskDashboard({ initialData }: PortfolioRiskDashboardProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('scenarioLoss')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Lista de estrategias únicas para el selector de filtro
  const availableStrategies = useMemo(() => {
    const set = new Set<string>()
    initialData.positions.forEach(p => {
      if (p.strategy) set.add(p.strategy)
    })
    return Array.from(set).sort()
  }, [initialData.positions])

  // Filtrado y ordenamiento de posiciones
  const filteredPositions = useMemo(() => {
    return initialData.positions
      .filter(item => {
        if (selectedStrategy !== 'ALL' && item.strategy !== selectedStrategy) {
          return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matchSym = item.symbol.toLowerCase().includes(q)
          const matchCode = item.trade_code.toLowerCase().includes(q)
          const matchStrat = item.strategy.toLowerCase().includes(q)
          if (!matchSym && !matchCode && !matchStrat) return false
        }
        return true
      })
      .sort((a, b) => {
        let valA: any = a[sortField]
        let valB: any = b[sortField]

        if (typeof valA === 'string') {
          valA = valA.toLowerCase()
          valB = (valB || '').toLowerCase()
          return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
        }

        valA = Number(valA) || 0
        valB = Number(valB) || 0
        return sortDir === 'asc' ? valA - valB : valB - valA
      })
  }, [initialData.positions, selectedStrategy, searchQuery, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span className="opacity-30 ml-1">↕</span>
    }
    return sortDir === 'asc' ? <span className="ml-1 text-indigo-600">↑</span> : <span className="ml-1 text-indigo-600">↓</span>
  }

  return (
    <div className="space-y-8">
      {/* 1. TARJETAS KPI EJECUTIVAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Risk */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Portfolio Risk
            </span>
            <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg font-bold">
              ⚠️
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-rose-600 tracking-tight font-mono">
              {formatMoney(initialData.totalRisk)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Monetary loss if all trailing stops trigger
            </p>
          </div>
        </div>

        {/* Total Capital */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Invested Capital
            </span>
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
              💼
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight font-mono">
              {formatMoney(initialData.totalCapital)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total market value of active positions
            </p>
          </div>
        </div>

        {/* Risk / Capital Ratio */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Risk / Capital Ratio
            </span>
            <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
              📊
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-600 tracking-tight font-mono">
              {formatPct(initialData.overallRiskPct)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Portfolio equity percentage at stop risk
            </p>
          </div>
        </div>

        {/* Active Positions */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Active Positions
            </span>
            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
              🎯
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight font-mono">
              {initialData.positions.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Across {initialData.summaries.length} active trading strategies
            </p>
          </div>
        </div>
      </div>

      {/* 2. TABLA RESUMEN POR ESTRATEGIA */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Risk Distribution by Strategy</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Capital exposure and dollar risk aggregated per active system
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {initialData.summaries.length} Systems Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-6">Strategy</th>
                <th className="py-3.5 px-4 text-center">Positions</th>
                <th className="py-3.5 px-6 text-right">Invested Capital</th>
                <th className="py-3.5 px-6 text-right">Risk to Stop</th>
                <th className="py-3.5 px-6 text-right">% of Total Risk</th>
                <th className="py-3.5 px-6 text-left w-48">Share of Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {initialData.summaries.map(item => (
                <tr key={item.strategy} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3.5 px-6 font-semibold text-gray-900">
                    <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-lg border ${getStrategyBadgeClass(item.strategy)}`}>
                      {item.strategy}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-gray-700">
                    {item.positionsCount}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono text-gray-900 font-medium">
                    {formatMoney(item.totalPositionAmount)}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono text-rose-600 font-bold">
                    {formatMoney(item.totalScenarioLoss)}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono text-gray-700 font-semibold">
                    {formatPct(item.pctOfPortfolioRisk)}
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
                      <div
                        className="bg-rose-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, item.pctOfPortfolioRisk * 100))}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold text-gray-900 border-t-2 border-gray-200 text-sm">
                <td className="py-4 px-6 uppercase tracking-wider text-xs">Portfolio Total</td>
                <td className="py-4 px-4 text-center font-mono">{initialData.positions.length}</td>
                <td className="py-4 px-6 text-right font-mono">{formatMoney(initialData.totalCapital)}</td>
                <td className="py-4 px-6 text-right font-mono text-rose-600">{formatMoney(initialData.totalRisk)}</td>
                <td className="py-4 px-6 text-right font-mono">100.00%</td>
                <td className="py-4 px-6">
                  <div className="w-full bg-rose-500 h-2 rounded-full" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 3. SIMULADOR / TABLA DE CURVA DE CAÍDAS (0% A 50%) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📉</span>
              <h3 className="text-lg font-bold text-gray-900">Stop-Loss Market Drop Absorption Simulation</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Simulates portfolio capital preservation as market drawdowns (0% to 50%) trigger trailing stops
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500"></span>
            <span>Protected / Cash</span>
            <span className="inline-block w-3 h-3 rounded-full bg-rose-400 ml-2"></span>
            <span>Exposed Capital</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-6 text-center">Market Drop</th>
                <th className="py-3.5 px-6 text-center">Stopped Positions</th>
                <th className="py-3.5 px-6 text-right">Protected Capital ($)</th>
                <th className="py-3.5 px-6 text-right">Remaining Exposed ($)</th>
                <th className="py-3.5 px-6 text-right">% Portfolio Protected</th>
                <th className="py-3.5 px-6 text-left w-72">Capital Decay Curve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-mono">
              {initialData.drops.map(level => {
                const protectedPct = initialData.totalCapital > 0 ? (level.stoppedOutCapital / initialData.totalCapital) : 0
                const remainingPct = 1 - protectedPct

                return (
                  <tr key={level.dropPct} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-6 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        level.dropPct === 0 ? 'bg-gray-100 text-gray-800' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        -{level.dropPct}%
                      </span>
                    </td>
                    <td className="py-3 px-6 text-center text-gray-700 font-sans">
                      {level.stoppedPositionsCount} / {initialData.positions.length}
                    </td>
                    <td className="py-3 px-6 text-right text-emerald-600 font-semibold">
                      {formatMoney(level.stoppedOutCapital)}
                    </td>
                    <td className="py-3 px-6 text-right text-gray-900 font-semibold">
                      {formatMoney(level.remainingCapital)}
                    </td>
                    <td className="py-3 px-6 text-right text-indigo-600 font-bold">
                      {formatPct(protectedPct)}
                    </td>
                    <td className="py-3 px-6 font-sans">
                      <div className="w-full bg-rose-100 rounded-full h-3 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-3 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, protectedPct * 100))}%` }}
                          title={`Protected: ${formatPct(protectedPct)}`}
                        />
                        <div
                          className="bg-rose-500 h-3 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, remainingPct * 100))}%` }}
                          title={`Exposed: ${formatPct(remainingPct)}`}
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

      {/* 4. TABLA DETALLADA DE POSICIONES */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Controles de filtro y búsqueda */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Positions Risk Detail</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Individual position stops, stop distance percentage, and dollar risk ordered by maximum exposure
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search symbol, code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filter by Strategy */}
            <select
              value={selectedStrategy}
              onChange={e => setSelectedStrategy(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="ALL">All Strategies ({initialData.positions.length})</option>
              {availableStrategies.map(strat => (
                <option key={strat} value={strat}>
                  {strat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 select-none">
                <th onClick={() => handleSort('trade_code')} className="py-3 px-4 cursor-pointer hover:text-gray-900">
                  Code {renderSortIndicator('trade_code')}
                </th>
                <th onClick={() => handleSort('symbol')} className="py-3 px-4 cursor-pointer hover:text-gray-900">
                  Symbol {renderSortIndicator('symbol')}
                </th>
                <th onClick={() => handleSort('strategy')} className="py-3 px-4 cursor-pointer hover:text-gray-900">
                  Strategy {renderSortIndicator('strategy')}
                </th>
                <th onClick={() => handleSort('currentPrice')} className="py-3 px-4 text-right cursor-pointer hover:text-gray-900">
                  Current Price {renderSortIndicator('currentPrice')}
                </th>
                <th onClick={() => handleSort('stopPrice')} className="py-3 px-4 text-right cursor-pointer hover:text-gray-900">
                  Stop {renderSortIndicator('stopPrice')}
                </th>
                <th onClick={() => handleSort('distancePct')} className="py-3 px-4 text-right cursor-pointer hover:text-gray-900">
                  Distance (%) {renderSortIndicator('distancePct')}
                </th>
                <th onClick={() => handleSort('positionAmount')} className="py-3 px-4 text-right cursor-pointer hover:text-gray-900">
                  Capital ($) {renderSortIndicator('positionAmount')}
                </th>
                <th onClick={() => handleSort('scenarioLoss')} className="py-3 px-4 text-right cursor-pointer hover:text-gray-900">
                  Risk to Stop ($) {renderSortIndicator('scenarioLoss')}
                </th>
                <th onClick={() => handleSort('pctOfStrategy')} className="py-3 px-4 text-right cursor-pointer hover:text-gray-900">
                  % of System {renderSortIndicator('pctOfStrategy')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-mono">
              {filteredPositions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 font-sans text-sm">
                    No positions found matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredPositions.map(pos => {
                  const isHedge = pos.strategy.toLowerCase().includes('hedge')
                  const isDistanceNegative = pos.distancePct <= 0 && !isHedge

                  return (
                    <tr key={`${pos.trade_code}-${pos.symbol}`} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-gray-600 font-sans text-xs">
                        {pos.trade_code}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {pos.symbol}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${getStrategyBadgeClass(pos.strategy)}`}>
                          {pos.strategy}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-800">
                        {formatMoney(pos.currentPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-800">
                        {isHedge ? (
                          <span className="text-gray-400 font-sans text-xs">N/A</span>
                        ) : pos.stopPrice > 0 ? (
                          formatMoney(pos.stopPrice)
                        ) : (
                          <span className="text-gray-400 font-sans text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isHedge ? (
                          <span className="text-gray-400 font-sans text-xs">Hedge</span>
                        ) : (
                          <span className={`font-semibold ${
                            isDistanceNegative
                              ? 'text-rose-600'
                              : pos.distancePct < 0.05
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}>
                            {formatPct(pos.distancePct)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900 font-medium">
                        {formatMoney(pos.positionAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        {formatMoney(pos.scenarioLoss)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 font-semibold">
                        {formatPct(pos.pctOfStrategy)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredPositions.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold text-gray-900 border-t-2 border-gray-200 text-sm font-mono">
                  <td colSpan={3} className="py-3.5 px-4 font-sans uppercase text-xs tracking-wider">
                    Total Displayed ({filteredPositions.length} positions)
                  </td>
                  <td colSpan={3}></td>
                  <td className="py-3.5 px-4 text-right">
                    {formatMoney(filteredPositions.reduce((acc, p) => acc + p.positionAmount, 0))}
                  </td>
                  <td className="py-3.5 px-4 text-right text-rose-600">
                    {formatMoney(filteredPositions.reduce((acc, p) => acc + p.scenarioLoss, 0))}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    -
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
