'use client'

import React, { useState, useMemo } from 'react'
import {
  HedgingDashboardData,
  HedgeContractItem,
  MarianShieldStep,
  RollAlertStatus
} from '../types'

interface HedgingDashboardProps {
  initialData: HedgingDashboardData
}

/** Formateador de moneda en inglés: $ 1,234.56 o -$ 1,234.56 */
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

/** Formateador de decimales simples: 1.15x */
const formatLeverage = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '0.00x'
  return `${val.toFixed(2)}x`
}

export default function HedgingDashboard({ initialData }: HedgingDashboardProps) {
  // Parámetros interactivos: Baseline IV y QQQ Spot manual editable
  const [baselineIV, setBaselineIV] = useState<number>(initialData.baselineIV || 22.0)
  const [manualQqqPrice, setManualQqqPrice] = useState<number>(initialData.budget.qqqPrice || 500)
  const [isEditingParams, setIsEditingParams] = useState<boolean>(false)

  // Recalcular métricas dinámicas si el usuario ajusta el Baseline IV o el precio de QQQ
  const dashboardData = useMemo(() => {
    const qqqPrice = manualQqqPrice > 0 ? manualQqqPrice : 500
    const targetStrike = Number((qqqPrice * 0.70).toFixed(2))

    // Recalcular contratos con el nuevo targetStrike
    const contracts: HedgeContractItem[] = initialData.hedgeContracts.map(c => {
      const rollUpNeeded = targetStrike > 0 && c.strike > 0 && c.strike < (targetStrike * 0.95)
      const rollForwardNeeded = c.days <= 30 && c.days > 0
      let status: RollAlertStatus = 'OK'
      if (rollUpNeeded && rollForwardNeeded) status = 'ROLL_BOTH'
      else if (rollUpNeeded) status = 'ROLL_UP'
      else if (rollForwardNeeded) status = 'ROLL_FORWARD'

      return {
        ...c,
        rollUpNeeded,
        rollForwardNeeded,
        status
      }
    })

    // Recalcular pasos de Marian Shield con el nuevo baselineIV y nuevo QQQ price
    const currentHedgeMarketValue = contracts.reduce((acc, h) => acc + Math.max(0, h.net_liq), 0)
    const totalEquity = initialData.budget.totalEquity > 0 ? initialData.budget.totalEquity : 1

    const steps: MarianShieldStep[] = initialData.marianShieldSteps.map(step => {
      const qqqDropPrice = Number((qqqPrice * (1 - step.dropDecimal)).toFixed(2))
      const projectedIV = Number((baselineIV + step.ivExpansionPts).toFixed(2))

      let projectedTotalPutsValue = 0
      let totalIntrinsic = 0
      let totalExtrinsic = 0

      for (const contract of contracts) {
        const contractsCount = Math.abs(contract.quantity)
        if (contractsCount === 0) continue

        const intrinsicPerShare = Math.max(0, contract.strike - qqqDropPrice)
        const contractIntrinsicTotal = intrinsicPerShare * 100 * contractsCount
        totalIntrinsic += contractIntrinsicTotal

        const days = Math.max(1, contract.days)
        const tYears = days / 365
        const ivDec = projectedIV / 100
        const moneyness = contract.strike > 0 ? qqqDropPrice / contract.strike : 1
        const moneynessFactor = Math.exp(-0.5 * Math.pow(Math.log(moneyness) / 0.3, 2))

        const extrinsicPerShare = 0.4 * qqqDropPrice * ivDec * Math.sqrt(tYears) * Math.max(0.15, moneynessFactor)
        const contractExtrinsicTotal = extrinsicPerShare * 100 * contractsCount
        totalExtrinsic += contractExtrinsicTotal

        projectedTotalPutsValue += (contractIntrinsicTotal + contractExtrinsicTotal)
      }

      const hedgeGainAmount = Math.max(0, projectedTotalPutsValue - currentHedgeMarketValue)
      const netLossAmount = Math.max(0, step.stockLossAmount - hedgeGainAmount)
      const bufferedDrawdownPct = totalEquity > 0 ? netLossAmount / totalEquity : 0

      const totalContractsCount = contracts.reduce((acc, h) => acc + Math.abs(h.quantity), 0)
      const avgIntrinsic = totalContractsCount > 0 ? totalIntrinsic / totalContractsCount : 0
      const avgExtrinsic = totalContractsCount > 0 ? totalExtrinsic / totalContractsCount : 0

      return {
        ...step,
        qqqDropPrice,
        projectedIV,
        hedgeGainAmount: Number(hedgeGainAmount.toFixed(2)),
        netLossAmount: Number(netLossAmount.toFixed(2)),
        bufferedDrawdownPct: Number(bufferedDrawdownPct.toFixed(4)),
        intrinsicValuePerContract: Number(avgIntrinsic.toFixed(2)),
        extrinsicValuePerContract: Number(avgExtrinsic.toFixed(2)),
        totalHedgeValue: Number(projectedTotalPutsValue.toFixed(2))
      }
    })

    return {
      budget: {
        ...initialData.budget,
        qqqPrice: Number(qqqPrice.toFixed(2)),
        targetStrike
      },
      hedgeContracts: contracts,
      totalHedgeValue: Number(currentHedgeMarketValue.toFixed(2)),
      baselineIV,
      marianShieldSteps: steps
    }
  }, [initialData, baselineIV, manualQqqPrice])

  const { budget, hedgeContracts, totalHedgeValue, marianShieldSteps } = dashboardData

  // Cálculo de protección máxima
  const maxDropStep = marianShieldSteps[marianShieldSteps.length - 1] // -50%
  const maxBufferedRelief = maxDropStep
    ? maxDropStep.stockDrawdownPct - maxDropStep.bufferedDrawdownPct
    : 0

  return (
    <div className="space-y-8">
      {/* 1. TOP STATS / EXECUTIVE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Hedge Value */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Hedge Value
            </span>
            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
              🛡️
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-600 tracking-tight font-mono">
              {formatMoney(totalHedgeValue)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Active QQQ/SPY protective Puts net liq
            </p>
          </div>
        </div>

        {/* Current Leverage & Layer Badge */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Current Leverage
            </span>
            <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold">
              ⚖️
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900 tracking-tight font-mono">
                {formatLeverage(budget.currentLeverage)}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                  budget.isLayer2Active
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {budget.isLayer2Active ? 'Layer 2 Active' : 'Base Only (≤1.0x)'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Positions: {formatMoney(budget.positionsValue)} / Equity: {formatMoney(budget.totalEquity)}
            </p>
          </div>
        </div>

        {/* Monthly Spitznagel Budget */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Monthly Hedge Budget
            </span>
            <span className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
              🎯
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-purple-600 tracking-tight font-mono">
              {formatMoney(budget.totalMonthlyBudget)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Annual: {formatMoney(budget.totalAnnualBudget)} ({formatPct(budget.totalHedgePct)} of equity)
            </p>
          </div>
        </div>

        {/* QQQ Spot & Target Strike */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              QQQ Spot / Target Strike
            </span>
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
              🎯
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-gray-900 tracking-tight font-mono">
                ${budget.qqqPrice.toFixed(2)}
              </span>
              <span className="text-sm font-semibold text-gray-400">→</span>
              <span className="text-2xl font-extrabold text-blue-600 tracking-tight font-mono">
                ${budget.targetStrike.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Target Put Strike @ 30% OTM (70% of spot)
            </p>
          </div>
        </div>
      </div>

      {/* 2. PARAMETERS & SPITZNAGEL LADDER FORMULA BREAKDOWN */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📐</span>
              <h3 className="text-lg font-bold text-gray-900">Pure Spitznagel Ladder Allocation Architecture</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Mechanical risk budget formula: Fixed Base Layer 1 (3% annual) + Convex Layer 2 (+0.4% per 0.25x excess leverage)
            </p>
          </div>
          <button
            onClick={() => setIsEditingParams(!isEditingParams)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-white hover:border-gray-400 transition-all cursor-pointer shadow-sm"
          >
            ⚙️ {isEditingParams ? 'Hide Parameter Adjuster' : 'Adjust IV / Spot'}
          </button>
        </div>

        {/* Collapsible Parameter Adjuster */}
        {isEditingParams && (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Baseline Put IV (%):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={baselineIV}
                  onChange={e => setBaselineIV(parseFloat(e.target.value) || 22.0)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setBaselineIV(22.0)}
                  className="px-2.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-xs transition-colors"
                >
                  Reset
                </button>
              </div>
              <p className="text-gray-400 mt-1">Default benchmark: 22.0% IV</p>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                QQQ Spot Reference ($):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={manualQqqPrice}
                  onChange={e => setManualQqqPrice(parseFloat(e.target.value) || 500)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setManualQqqPrice(initialData.budget.qqqPrice || 500)}
                  className="px-2.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-xs transition-colors"
                >
                  Sync
                </button>
              </div>
              <p className="text-gray-400 mt-1">Auto-detected from active positions or quotes</p>
            </div>

            <div className="sm:col-span-2 lg:col-span-1 flex flex-col justify-center bg-white p-3 rounded-lg border border-gray-200">
              <span className="font-semibold text-gray-600">Model Dynamics:</span>
              <span className="text-gray-500 mt-0.5">
                Target Put Strike: <strong className="text-blue-600">${budget.targetStrike.toFixed(2)}</strong> (30% OTM)
              </span>
              <span className="text-gray-500">
                Roll Up Threshold: <strong className="text-amber-600">&lt; ${(budget.targetStrike * 0.95).toFixed(2)}</strong> (95% of target)
              </span>
            </div>
          </div>
        )}

        {/* Spitznagel Formula Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-mono">
          {/* Layer 1 */}
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Layer 1: Base Allocation (3.0% Fixed)
            </div>
            <div className="text-xl font-extrabold text-blue-900 mt-2">
              {formatMoney(budget.annualBaseBudget)} / yr
            </div>
            <div className="text-xs text-blue-700 mt-1">
              Monthly: <strong>{formatMoney(budget.monthlyBaseBudget)}</strong>
            </div>
            <div className="text-[11px] text-gray-500 mt-2 font-sans">
              Mechanical base insurance covering systemic equity against unexpected gaps.
            </div>
          </div>

          {/* Layer 2 */}
          <div className={`p-4 rounded-xl border ${
            budget.isLayer2Active ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-gray-50/60'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${
                budget.isLayer2Active ? 'text-amber-800' : 'text-gray-500'
              }`}>
                Layer 2: Leverage Surcharge
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                budget.isLayer2Active ? `bg-amber-200 text-amber-900` : 'bg-gray-200 text-gray-600'
              }`}>
                {budget.isLayer2Active ? `+${(budget.excessUnits * 0.4).toFixed(2)}% Ann.` : 'Inactive (0.0%)'}
              </span>
            </div>
            <div className={`text-xl font-extrabold mt-2 ${
              budget.isLayer2Active ? 'text-amber-900' : 'text-gray-400'
            }`}>
              {formatMoney(budget.annualExposureBudget)} / yr
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Monthly: <strong>{formatMoney(budget.monthlyExposureBudget)}</strong>
            </div>
            <div className="text-[11px] text-gray-500 mt-2 font-sans">
              {budget.isLayer2Active
                ? `Excess leverage: +${budget.leverageIncrease.toFixed(2)}x (${budget.excessUnits.toFixed(2)} units of 0.25x).`
                : 'Account operates within 1.0x unleveraged baseline.'}
            </div>
          </div>

          {/* Total Budget */}
          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
            <div className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
              Total Spitznagel Hedge Budget
            </div>
            <div className="text-xl font-extrabold text-purple-900 mt-2">
              {formatMoney(budget.totalAnnualBudget)} / yr
            </div>
            <div className="text-xs text-purple-700 mt-1">
              Monthly: <strong>{formatMoney(budget.totalMonthlyBudget)}</strong> ({formatPct(budget.totalHedgePct)} Ann.)
            </div>
            <div className="text-[11px] text-gray-500 mt-2 font-sans">
              Mechanical target capital allocated to continuous rolling QQQ 30% OTM Put protection.
            </div>
          </div>
        </div>
      </div>




      {/* 3. ACTIVE PUTS AUDIT & ROLL ALERTS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <h3 className="text-lg font-bold text-gray-900">Active Protective Puts (QQQ / SPY)</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Roll Up Alert when Strike &lt; 95% of Target (${(budget.targetStrike * 0.95).toFixed(2)}) | Roll Forward Alert when Expiration &le; 30 Days
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            {hedgeContracts.length} Contracts Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 select-none">
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Contract / Key</th>
                <th className="py-3 px-4 text-right">Strike</th>
                <th className="py-3 px-4 text-center">Expiration</th>
                <th className="py-3 px-4 text-center">Days (DTE)</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Net Liq</th>
                <th className="py-3 px-4 text-right">Delta</th>
                <th className="py-3 px-4 text-right">Theta</th>
                <th className="py-3 px-4 text-center">Roll Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-mono">
              {hedgeContracts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400 font-sans text-sm">
                    No active protective Put contracts found for QQQ or SPY in the current portfolio.
                  </td>
                </tr>
              ) : (
                hedgeContracts.map((contract) => {
                  return (
                    <tr key={contract.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-900 font-sans">
                        {contract.symbol}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600">
                        {contract.unique_key}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">
                        ${contract.strike.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-gray-700">
                        {contract.expiration}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            contract.days <= 30
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'text-gray-800'
                          }`}
                        >
                          {contract.days}d
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-700">
                        {contract.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatMoney(contract.net_liq)}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-gray-600">
                        {contract.option_delta.toFixed(4)}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-gray-600">
                        {contract.option_theta.toFixed(4)}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        {contract.status === 'OK' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✅ OK
                          </span>
                        )}
                        {contract.status === 'ROLL_UP' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            ⚠️ Roll Up Needed
                          </span>
                        )}
                        {contract.status === 'ROLL_FORWARD' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                            ⚠️ Roll Forward
                          </span>
                        )}
                        {contract.status === 'ROLL_BOTH' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300">
                            🚨 Roll Up & Forward
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {hedgeContracts.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold text-gray-900 border-t-2 border-gray-200 text-sm font-mono">
                  <td colSpan={6} className="py-3 px-4 uppercase tracking-wider text-xs font-sans">
                    Total Active Put Hedge
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-600 font-extrabold">
                    {formatMoney(totalHedgeValue)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. THE MARIAN SHIELD (v4.0): ASYMMETRIC STOPS & PUT PROTECTION SIMULATION (UP TO -50%) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <h3 className="text-lg font-bold text-gray-900">The Marian Shield (v4.0) — Stress Test & Convexity Simulator</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Cascade stop absorption vs. asymmetric Put payoff extended to -50% systemic crash with dynamic IV expansion (Baseline IV: {baselineIV}%)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Unhedged Loss
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Marian Shield Buffered
            </span>
          </div>
        </div>

        {/* Visual Drawdown Comparison Chart */}
        <div className="p-6 bg-gray-50/50 border-b border-gray-100">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">
            Drawdown Comparison: Unhedged vs. Marian Shield Protected (-5% to -50%)
          </div>
          <div className="space-y-3 font-mono text-xs">
            {marianShieldSteps.map((step) => {
              const unhedgedPct = step.stockDrawdownPct * 100
              const bufferedPct = step.bufferedDrawdownPct * 100
              const reliefPct = Math.max(0, unhedgedPct - bufferedPct)

              return (
                <div key={step.dropPct} className="flex items-center gap-3">
                  <div className="w-16 font-bold text-gray-700 shrink-0">
                    -{step.dropPct}% drop
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-5 relative overflow-hidden flex">
                    {/* Buffered Drawdown (Protected loss) */}
                    <div
                      className="bg-emerald-500 h-5 transition-all duration-300"
                      style={{ width: `${Math.min(100, bufferedPct)}%` }}
                      title={`Buffered Drawdown: ${bufferedPct.toFixed(2)}%`}
                    />
                    {/* Absorbed / Shielded by Hedge Puts */}
                    <div
                      className="bg-purple-500/80 h-5 transition-all duration-300"
                      style={{ width: `${Math.min(100 - bufferedPct, reliefPct)}%` }}
                      title={`Shielded by Puts: +${reliefPct.toFixed(2)}%`}
                    />
                  </div>
                  <div className="w-48 text-right shrink-0">
                    <span className="text-rose-600 font-bold">{formatPct(step.stockDrawdownPct)}</span>
                    <span className="text-gray-400 mx-1">→</span>
                    <span className="text-emerald-600 font-extrabold">{formatPct(step.bufferedDrawdownPct)}</span>
                    <span className="text-xs text-purple-600 font-sans ml-1">(-{(reliefPct).toFixed(1)}%)</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Full Marian Shield Stress Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 select-none">
                <th className="py-3 px-4 text-center">Market Drop</th>
                <th className="py-3 px-4 text-right">QQQ Spot</th>
                <th className="py-3 px-4 text-center">&Delta; IV / Proj. IV</th>
                <th className="py-3 px-4 text-right">Exposed Stocks</th>
                <th className="py-3 px-4 text-right">Stock Loss ($)</th>
                <th className="py-3 px-4 text-right">Unhedged DD (%)</th>
                <th className="py-3 px-4 text-right text-purple-700">Hedge Gain ($)</th>
                <th className="py-3 px-4 text-right text-emerald-700">Net Loss ($)</th>
                <th className="py-3 px-4 text-right text-emerald-700">Buffered DD (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-mono">
              {marianShieldSteps.map((step) => {
                const isSevere = step.dropPct >= 20
                const isCatastrophic = step.dropPct >= 40

                return (
                  <tr
                    key={step.dropPct}
                    className={`hover:bg-gray-50/60 transition-colors ${
                      isCatastrophic ? 'bg-red-50/20' : (isSevere ? 'bg-amber-50/15' : '')
                    }`}
                  >
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          step.dropPct >= 30
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : (step.dropPct >= 15 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-800')
                        }`}
                      >
                        -{step.dropPct}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      ${step.qqqDropPrice.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center text-xs">
                      <span className="text-indigo-600 font-semibold">+{step.ivExpansionPts.toFixed(1)}</span>
                      <span className="text-gray-400 mx-1">|</span>
                      <span className="text-gray-900 font-bold">{step.projectedIV.toFixed(1)}%</span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 text-xs">
                      {formatMoney(step.remainingStockExposure)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 font-bold">
                      {formatMoney(step.stockLossAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-700 font-extrabold">
                      {formatPct(step.stockDrawdownPct)}
                    </td>
                    <td className="py-3 px-4 text-right text-purple-600 font-extrabold">
                      +{formatMoney(step.hedgeGainAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-bold">
                      {formatMoney(step.netLossAmount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {formatPct(step.bufferedDrawdownPct)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
