'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { Strategy, TradeEnrichmentItem } from '../types'
import { getTradesForEnrichment, getActiveStrategies, batchUpdateTradesEnrichment } from '../services/queries'

export interface Step2TelemetryLog {
  id: string
  time: string
  type: 'MOUNT' | 'RENDER' | 'EFFECT' | 'FETCH_START' | 'FETCH_DEDUP' | 'FETCH_SUCCESS' | 'CLEANUP' | 'ERROR'
  title: string
  details?: string
  color: string
}

// Global in-flight cache to deduplicate simultaneous requests for the same tradeCodes (e.g. StrictMode remounts)
const inFlightEnrichmentRequests = new Map<string, Promise<{ trades: TradeEnrichmentItem[]; strategies: Strategy[] }>>()

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

  // Keep a stable reference to onClose to prevent effect re-triggers on parent re-renders
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // --- Step 2 Web Tracking & Diagnostics ---
  const renderCountRef = useRef(0)
  const effectCountRef = useRef(0)
  const fetchCountRef = useRef(0)
  const telemetryLogsRef = useRef<Step2TelemetryLog[]>([])

  const [telemetryLogs, setTelemetryLogs] = useState<Step2TelemetryLog[]>([])
  const [showTelemetry, setShowTelemetry] = useState(false)
  const [copied, setCopied] = useState(false)

  renderCountRef.current += 1

  // Stable key for tradeCodes
  const tradeCodesKey = Array.isArray(tradeCodes) ? [...tradeCodes].sort().join(',') : ''

  const addLog = (
    type: Step2TelemetryLog['type'],
    title: string,
    details?: string,
    color = '#6366f1'
  ) => {
    const now = new Date()
    const timeStr = now.toLocaleTimeString() + '.' + String(now.getMilliseconds()).padStart(3, '0')
    const entry: Step2TelemetryLog = {
      id: Math.random().toString(36).substring(2, 9),
      time: timeStr,
      type,
      title,
      details,
      color
    }

    console.log(
      `%c[Step 2 Tracker] [${entry.type}] ${entry.title}`,
      `color: ${color}; font-weight: bold;`,
      details ? { details, time: timeStr } : { time: timeStr }
    )

    telemetryLogsRef.current = [entry, ...telemetryLogsRef.current].slice(0, 50)
  }

  // Data fetching effect - strictly keyed by isOpen and tradeCodesKey (NOT volatile onClose reference)
  useEffect(() => {
    effectCountRef.current += 1
    const effectRun = effectCountRef.current

    if (!isOpen || !tradeCodes || tradeCodes.length === 0) {
      addLog('EFFECT', `Fetch effect #${effectRun} skipped`, 'Modal closed or tradeCodes empty', '#9ca3af')
      setEnrichTrades([])
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)

    addLog('EFFECT', `Data fetch effect triggered (Run #${effectRun})`, `Key: [${tradeCodesKey}]`, '#8b5cf6')

    const fetchStart = performance.now()

    const fetchEnrichmentData = async () => {
      let isDedup = false
      let requestPromise = inFlightEnrichmentRequests.get(tradeCodesKey)

      if (!requestPromise) {
        fetchCountRef.current += 1
        const fetchId = fetchCountRef.current
        addLog('FETCH_START', `Fetch #${fetchId} started for tradeCodes: [${tradeCodes.join(', ')}]`, 'Requesting enrichment data from Supabase...', '#d97706')

        requestPromise = Promise.all([
          getTradesForEnrichment(supabase, tradeCodes),
          getActiveStrategies(supabase)
        ]).then(([trades, strats]) => ({
          trades: trades || [],
          strategies: strats || []
        })).finally(() => {
          setTimeout(() => inFlightEnrichmentRequests.delete(tradeCodesKey), 1500)
        })

        inFlightEnrichmentRequests.set(tradeCodesKey, requestPromise)
      } else {
        isDedup = true
        addLog('FETCH_DEDUP', `Reusing existing in-flight request for tradeCodes: [${tradeCodes.join(', ')}]`, 'Prevented duplicate query to Supabase.', '#06b6d4')
      }

      try {
        const { trades, strategies: strats } = await requestPromise
        const elapsed = Math.round(performance.now() - fetchStart)

        if (!isMounted) {
          addLog('CLEANUP', `Request finished after ${elapsed}ms but component unmounted / effect cancelled`, 'Race condition avoided.', '#ef4444')
          return
        }

        if (!trades || trades.length === 0) {
          addLog('FETCH_SUCCESS', `Completed in ${elapsed}ms: 0 trades pending review`, 'Closing modal automatically.', '#f59e0b')
          onCloseRef.current?.()
          return
        }

        addLog('FETCH_SUCCESS', `Completed in ${elapsed}ms${isDedup ? ' (deduplicated)' : ''}: loaded ${trades.length} trades, ${strats?.length || 0} strategies`, 'Ready for user review.', '#10b981')
        setStrategies(strats || [])
        setEnrichTrades(trades)
        setTelemetryLogs([...telemetryLogsRef.current])
      } catch (err: any) {
        addLog('ERROR', `Fetch failed: ${err.message}`, err.stack, '#dc2626')
        console.error('[ReviewNewTradesModal] Error loading enrichment data:', err)
        if (isMounted) onCloseRef.current?.()
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchEnrichmentData()

    return () => {
      isMounted = false
      addLog('CLEANUP', `Cleanup for effect #${effectRun}`, 'Effect dependencies changed or modal unmounted.', '#6b7280')
    }
  }, [isOpen, tradeCodesKey])

  if (!isOpen) return null

  const handleCopyTrace = () => {
    const list = telemetryLogs.length > 0 ? telemetryLogs : telemetryLogsRef.current
    const text = list.map(l => `[${l.time}] [${l.type}] ${l.title}${l.details ? ` - ${l.details}` : ''}`).join('\n')
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUpdateItem = (tradeCode: number, field: 'strategy_id' | 'stock_entry_price', val: any) => {
    setEnrichTrades(prev => prev.map(item => {
      if (item.trade_code !== tradeCode) return item
      return { ...item, [field]: val }
    }))
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    addLog('RENDER', 'Saving trade enrichment updates...', `Submitting ${enrichTrades.length} records to Supabase`, '#2563eb')
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
      addLog('ERROR', `Save failed: ${err.message}`, err.stack, '#dc2626')
      alert('Error saving trade details: ' + (err.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    if (saving) return
    addLog('RENDER', 'User skipped Step 2 without saving', 'Triggering transactions-changed and closing modal', '#6b7280')
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

        {/* STEP 2 LIVE TRACKER BAR (ON-SCREEN TELEMETRY) */}
        <div className="bg-slate-900 text-white px-6 py-2.5 flex flex-wrap items-center justify-between text-xs border-b border-slate-800">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1.5 font-bold text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Step 2 Tracker:
            </span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
              Renders: <strong className="text-white">{renderCountRef.current}</strong>
            </span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
              Effects: <strong className="text-white">{effectCountRef.current}</strong>
            </span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
              Fetches: <strong className={fetchCountRef.current > 1 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{fetchCountRef.current}</strong>
            </span>
            {fetchCountRef.current > 1 && (
              <span className="bg-amber-950/80 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded text-[11px] font-semibold animate-pulse">
                ⚠️ Loaded {fetchCountRef.current} times!
              </span>
            )}
          </div>

          <button
            onClick={() => {
              setTelemetryLogs([...telemetryLogsRef.current])
              setShowTelemetry(!showTelemetry)
            }}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium px-2.5 py-1 rounded transition cursor-pointer mt-1 sm:mt-0 flex items-center gap-1.5"
          >
            <svg className={`w-3.5 h-3.5 transform transition-transform ${showTelemetry ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showTelemetry ? 'Hide Trace' : `View Live Trace (${telemetryLogsRef.current.length || telemetryLogs.length})`}
          </button>
        </div>

        {/* EXPANDABLE TELEMETRY DRAWER */}
        {showTelemetry && (
          <div className="bg-slate-950 text-slate-200 px-6 py-3 border-b border-slate-800 max-h-56 overflow-y-auto text-xs font-mono space-y-1.5 shadow-inner">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] text-slate-400 font-sans">
              <span className="font-semibold text-slate-300">Live Execution Log (Recent First)</span>
              <button 
                onClick={handleCopyTrace}
                className="hover:text-white underline cursor-pointer text-indigo-400 hover:text-indigo-300 font-mono"
              >
                {copied ? '✓ Copied to clipboard' : 'Copy Trace'}
              </button>
            </div>

            {fetchCountRef.current > 1 && (
              <div className="bg-amber-950/70 border border-amber-700/50 text-amber-200 p-2.5 rounded-lg text-xs font-sans mb-2">
                <p className="font-bold mb-1 flex items-center gap-1">
                  <span>⚠️ Diagnostic: Why did Step 2 load {fetchCountRef.current} times?</span>
                </p>
                <p className="text-[11px] leading-relaxed text-amber-100/90">
                  Multiple effect invocations detected. Common causes include the parent component recreating volatile callback props (e.g. <code>onClose</code>) on re-render, background <code>router.refresh()</code> execution, or React 18 StrictMode double-invoking effects on initial mount.
                </p>
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              {telemetryLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2 text-[11px] border-b border-slate-900/80 pb-1">
                  <span className="text-slate-500 font-mono shrink-0 select-none">{log.time}</span>
                  <span 
                    className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 font-sans" 
                    style={{ backgroundColor: `${log.color}25`, color: log.color, border: `1px solid ${log.color}50` }}
                  >
                    {log.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-200">{log.title}</span>
                    {log.details && <span className="text-slate-400 ml-1.5 break-all">({log.details})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
