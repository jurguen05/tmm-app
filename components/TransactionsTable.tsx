'use client'

import { Fragment, useState } from 'react'
import { Transaction, Strategy } from '../types'
import { formatearMoneda, formatearFecha } from '../lib/formatters'

export interface TradeTransactionGroup {
  groupKey: string
  trade_code: number | null
  symbol: string
  unique_key: string
  instrument: 'Stock' | 'Option'
  strategy_id: number | null
  stock_entry_price: number | null
  status: 'Open' | 'Closed'
  first_buy_date: string | null
  latest_date: string
  net_cash_flow: number
  transactions: Transaction[]
}

interface TransactionsTableProps {
  grupos: TradeTransactionGroup[]
  estrategias: Strategy[]
  expandedKeys: Set<string>
  onToggleExpand: (groupKey: string) => void
  onActualizarTradeGroup: (group: TradeTransactionGroup, campo: 'strategy_id' | 'stock_entry_price', valor: any) => void
}

function extraerDetalleOpcion(tx: Transaction, groupSymbol: string): string {
  const base = (tx.unique_key || tx.description || '').trim()
  if (!base) return ''
  const sym = (tx.symbol || groupSymbol || '').trim()
  if (sym) {
    const escapedSym = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const stripped = base.replace(new RegExp(`^${escapedSym}[-\\s]+`, 'i'), '').trim()
    if (stripped) return stripped
  }
  const dashIdx = base.indexOf('-')
  if (dashIdx !== -1 && dashIdx < 8) {
    return base.slice(dashIdx + 1).trim()
  }
  return base
}

export default function TransactionsTable({
  grupos,
  estrategias,
  expandedKeys,
  onToggleExpand,
  onActualizarTradeGroup
}: TransactionsTableProps) {
  const [editingPriceTarget, setEditingPriceTarget] = useState<string | null>(null)
  const [tempPriceValue, setTempPriceValue] = useState<string>('')

  const thBase = 'px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap'
  const tdBase = 'px-4 py-2.5 text-sm text-gray-800 font-normal'
  const tdCenter = `${tdBase} text-center whitespace-nowrap`
  const tdRight = `${tdBase} text-right whitespace-nowrap`

  const handleStartEditPrice = (targetKey: string, currentPrice: number | null) => {
    setEditingPriceTarget(targetKey)
    setTempPriceValue(currentPrice !== null && currentPrice !== undefined ? String(currentPrice) : '')
  }

  const handleCommitEditPrice = (group: TradeTransactionGroup) => {
    setEditingPriceTarget(null)
    const parsed = tempPriceValue.trim() === '' ? null : parseFloat(tempPriceValue)
    const normalized = parsed !== null && !isNaN(parsed) ? parsed : null
    if (normalized !== (group.stock_entry_price ?? null)) {
      onActualizarTradeGroup(group, 'stock_entry_price', normalized)
    }
  }

  return (
    <div className="bg-white overflow-hidden overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className={`${thBase} text-left pl-8`}>Date</th>
            <th className={`${thBase} text-center`}>Instrument</th>
            <th className={`${thBase} text-center`}>Action</th>
            <th className={`${thBase} text-right`}>Stock Entry Price</th>
            <th className={`${thBase} text-center`}>Quantity</th>
            <th className={`${thBase} text-right`}>Price</th>
            <th className={`${thBase} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {grupos.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                No transactions match your search.
              </td>
            </tr>
          ) : (
            grupos.map((group) => {
              const isExpanded = expandedKeys.has(group.groupKey)
              const bannerEditKey = `banner-${group.groupKey}`

              return (
                <Fragment key={group.groupKey}>
                  {/* Barra Maestra 100% Ancho */}
                  <tr
                    onClick={() => onToggleExpand(group.groupKey)}
                    className={`cursor-pointer transition-colors ${
                      isExpanded
                        ? 'bg-indigo-50/60 hover:bg-indigo-50/90'
                        : 'bg-gray-50/80 hover:bg-gray-100/80'
                    }`}
                  >
                    <td colSpan={7} className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Lado Izquierdo: Flecha + Code + Strategy + Symbol + Status */}
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`inline-block text-xs font-bold transition-transform ${
                              isExpanded ? 'rotate-90 text-indigo-600' : 'text-gray-500'
                            }`}
                          >
                            ▶
                          </span>

                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                            CODE {group.trade_code || '-'}
                          </span>

                          <div onClick={(e) => e.stopPropagation()}>
                            <select
                              value={group.strategy_id || ''}
                              onChange={(e) => {
                                const nuevoId = e.target.value ? Number(e.target.value) : null
                                onActualizarTradeGroup(group, 'strategy_id', nuevoId)
                              }}
                              className="px-2.5 py-1 border border-gray-300 rounded text-xs font-medium bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">Select strategy...</option>
                              {estrategias.map((est) => (
                                <option key={est.id} value={est.id}>
                                  {est.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <span className="text-sm font-bold text-gray-900">{group.symbol}</span>

                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              group.status === 'Open'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {group.status}
                          </span>
                        </div>

                        {/* Lado Derecho: Stock Entry editable + Cantidad de Fills */}
                        <div
                          className="flex flex-wrap items-center gap-4 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500">Stock Entry:</span>
                            {editingPriceTarget === bannerEditKey ? (
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                value={tempPriceValue}
                                onChange={(e) => setTempPriceValue(e.target.value)}
                                onBlur={() => handleCommitEditPrice(group)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCommitEditPrice(group)
                                  if (e.key === 'Escape') setEditingPriceTarget(null)
                                }}
                                placeholder="0.00"
                                className="w-20 px-2 py-0.5 border border-indigo-500 rounded text-xs font-medium text-right bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStartEditPrice(bannerEditKey, group.stock_entry_price)
                                }
                                className="font-semibold text-gray-800 underline decoration-dotted hover:text-indigo-600 cursor-pointer"
                                title="Click to edit Stock Entry Price"
                              >
                                {group.stock_entry_price
                                  ? formatearMoneda(group.stock_entry_price)
                                  : '0,00'}
                              </button>
                            )}
                          </div>

                          <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600 font-medium">
                            {group.transactions.length}{' '}
                            {group.transactions.length === 1 ? 'fill' : 'fills'}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Filas de Detalle: Si es Stock el campo Instrument viene vacío; si es Option muestra vencimiento/strike/tipo sin repetir el símbolo */}
                  {isExpanded &&
                    group.transactions.map((t) => {
                      const rowEditKey = `row-${t.id}`
                      const optionDetail =
                        t.instrument === 'Option' ? extraerDetalleOpcion(t, group.symbol) : ''

                      return (
                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                          <td className={`${tdBase} pl-8 whitespace-nowrap`}>
                            {formatearFecha(t.date)}
                          </td>
                          <td className={tdCenter}>
                            {t.instrument === 'Option' && optionDetail ? (
                              <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 font-mono">
                                {optionDetail}
                              </span>
                            ) : null}
                          </td>
                          <td className={tdCenter}>{t.action}</td>

                          {/* Stock Entry Price */}
                          <td className={tdRight}>
                            {editingPriceTarget === rowEditKey ? (
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                value={tempPriceValue}
                                onChange={(e) => setTempPriceValue(e.target.value)}
                                onBlur={() => handleCommitEditPrice(group)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCommitEditPrice(group)
                                  if (e.key === 'Escape') setEditingPriceTarget(null)
                                }}
                                placeholder="0.00"
                                className="w-20 px-2 py-1 border border-indigo-500 rounded text-sm font-normal focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                              />
                            ) : (
                              <div
                                onClick={() =>
                                  handleStartEditPrice(rowEditKey, group.stock_entry_price)
                                }
                                className="cursor-pointer w-full px-2 py-1 border border-transparent hover:bg-gray-100 hover:border-gray-300 rounded text-sm transition-all"
                                title="Click to edit Stock Entry Price for this trade"
                              >
                                {group.stock_entry_price ? (
                                  formatearMoneda(group.stock_entry_price)
                                ) : (
                                  <span className="text-gray-400">0,00</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className={tdCenter}>{t.quantity}</td>
                          <td className={tdRight}>{formatearMoneda(t.price)}</td>
                          <td className={tdRight}>{formatearMoneda(t.amount)}</td>
                        </tr>
                      )
                    })}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}