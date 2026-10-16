'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { Strategy, TradeEnrichmentItem } from '../types'
import { getTradesForEnrichment, getActiveStrategies, batchUpdateTradesEnrichment } from '../services/queries'

interface ReviewNewTradesModalProps {
  isOpen: boolean
  tradeCodes: number[]
  onClose: () => void
  onSaved?: () => void
}

export default function ReviewNewTradesModal({
  isOpen,
  tradeCodes,
  onClose,
  onSaved
}: ReviewNewTradesModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [enrichTrades, setEnrichTrades] = useState<TradeEnrichmentItem[]>([])

  useEffect(() => {
    if (!isOpen || !tradeCodes || tradeCodes.length === 0) {
      setEnrichTrades([])
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)

    const fetchEnrichmentData = async () => {
      try {
        const [trades, strats] = await Promise.all([
          getTradesForEnrichment(supabase, tradeCodes),
          getActiveStrategies(supabase)
        ])

        if (!isMounted) return

        if (!trades || trades.length === 0) {
          onClose()
          return
        }

        setStrategies(strats || [])
        setEnrichTrades(trades)
      } catch (err: any) {
        console.error('[ReviewNewTradesModal] Error loading enrichment data:', err)
        if (isMounted) onClose()
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchEnrichmentData()

    return () => {
      isMounted = false
    }
  }, [isOpen, tradeCodes, onClose])

  if (!isOpen) return null

  const handleUpdateItem = (tradeCode: number, field: 'strategy_id' | 'stock_entry_price', val: any) => {
    setEnrichTrades(prev => prev.map(item => {
      if (item.trade_code !== tradeCode) return item
      return { ...item, [field]: val }
    }))
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const payload = enrichTrades.map(t => ({
        trade_code: t.trade_code,
        strategy_id: t.strategy_id ? Number(t.strategy_id) : null,
        stock_entry_price: t.stock_entry_price !== null && t.stock_entry_price !== undefined ? Number(t.stock_entry_price) : null
      }))
      await batchUpdateTradesEnrichment(supabase, payload)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('transactions-changed'))
      }
      router.refresh()
      onSaved?.()
      onClose()
    } catch (err: any) {
      alert('Error saving trade details: ' + (err.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    if (saving) return
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('transactions-changed'))
    }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-gray-150 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* STEP 2 HEADER */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 leading-tight">Review New Trades</h2>
                <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Step 2 of 2
                </span>
              </div>
              <p className="text-xs text-gray-500">Set strategy and stock entry price for newly imported trades</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 cursor-pointer"
            title="Close without saving"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QUICK HINT BANNER */}
        <div className="px-6 py-2.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-xs text-blue-700">
          <span className="flex items-center gap-1.5 font-medium">
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Values for stock trades are prefilled. Use <kbd className="px-1.5 py-0.5 bg-white rounded border border-blue-200 text-[10px] font-mono shadow-xs">Tab</kbd> to quickly cycle across fields.
          </span>
          <span className="font-semibold text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded-full text-[11px]">
            {enrichTrades.length} trade{enrichTrades.length !== 1 ? 's' : ''} pending
          </span>
        </div>

        {/* CONTENT */}
        <div className="overflow-x-auto overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Loading new trades...
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-xs z-10 border-b border-gray-200">
                <tr className="text-gray-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-6 w-28">Trade Code</th>
                  <th className="py-3 px-4 w-32">Symbol</th>
                  <th className="py-3 px-4">Strategy <span className="text-red-500">*</span></th>
                  <th className="py-3 px-6 w-52 text-right">Stock Entry Price ($) <span className="text-red-500">*</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrichTrades.map((item) => (
                  <tr key={item.trade_code} className="hover:bg-gray-50/70 transition-colors">
                    {/* Trade Code */}
                    <td className="py-3.5 px-6 font-mono font-medium text-gray-800">
                      <span className="bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200 text-xs">
                        #{item.trade_code}
                      </span>
                    </td>

                    {/* Symbol */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">{item.symbol}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          item.instrument === 'Option' 
                            ? 'bg-purple-50 text-purple-700 border-purple-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {item.instrument === 'Option' ? 'Opt' : 'Stock'}
                        </span>
                      </div>
                    </td>

                    {/* Strategy */}
                    <td className="py-3.5 px-4">
                      <select
                        value={item.strategy_id ?? ''}
                        onChange={(e) => handleUpdateItem(item.trade_code, 'strategy_id', e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                      >
                        <option value="">Select Strategy...</option>
                        {strategies.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Stock Entry Price */}
                    <td className="py-3.5 px-6 text-right">
                      <div className="relative inline-block w-40">
                        <span className="absolute left-2.5 top-1.5 text-gray-400 text-xs font-mono">$</span>
                        <input
                          type="number"
                          step="0.01"
                          disabled={item.is_stock}
                          value={item.stock_entry_price ?? ''}
                          onChange={(e) => handleUpdateItem(item.trade_code, 'stock_entry_price', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="0.00"
                          title={item.is_stock ? "Auto-detected from stock fill price" : "Stock price when option was opened"}
                          className={`w-full rounded-lg pl-6 pr-2.5 py-1.5 text-xs font-mono text-right focus:outline-none focus:ring-1 transition-all ${
                            item.is_stock
                              ? 'bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-900 border border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 font-semibold'
                          }`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* STEP 2 FOOTER */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium cursor-pointer"
          >
            Skip for now (fill later in Transactions)
          </button>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                Save & Complete
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
