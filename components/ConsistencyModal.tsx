'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ConsistencyAuditResult, ConsistencyIssue, ConsistencySeverity } from '../types'

interface ConsistencyModalProps {
  isOpen: boolean
  onClose: () => void
  audit: ConsistencyAuditResult | null
  onRefresh?: () => void
  isRefreshing?: boolean
}

export default function ConsistencyModal({
  isOpen,
  onClose,
  audit,
  onRefresh,
  isRefreshing = false
}: ConsistencyModalProps) {
  const [filterSeverity, setFilterSeverity] = useState<'all' | ConsistencySeverity>('all')

  if (!isOpen) return null

  const issues = audit?.issues || []
  const filteredIssues = filterSeverity === 'all'
    ? issues
    : issues.filter(i => i.severity === filterSeverity)

  const redCount = audit?.redCount || 0
  const yellowCount = audit?.yellowCount || 0

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/70">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              audit?.maxSeverity === 'red'
                ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Portfolio Consistency Issues
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  audit?.maxSeverity === 'red'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {issues.length} {issues.length === 1 ? 'Issue' : 'Issues'}
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Audit across Positions Statement, Trades & Strategies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Re-run audit"
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 flex items-center justify-center transition-colors cursor-pointer text-xs"
              >
                <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 flex items-center justify-center transition-colors cursor-pointer text-sm font-semibold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* FILTER PILLS */}
        {issues.length > 0 && (
          <div className="px-6 py-2.5 bg-gray-950/40 border-b border-gray-800/80 flex items-center gap-2 text-xs">
            <span className="text-gray-400 font-medium mr-1">Filter:</span>
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                filterSeverity === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              All ({issues.length})
            </button>
            {redCount > 0 && (
              <button
                onClick={() => setFilterSeverity('red')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer font-medium ${
                  filterSeverity === 'red'
                    ? 'bg-red-500/30 text-red-200 border border-red-500/50'
                    : 'text-red-400 hover:bg-red-500/10'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                <span>Critical ({redCount})</span>
              </button>
            )}
            {yellowCount > 0 && (
              <button
                onClick={() => setFilterSeverity('yellow')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer font-medium ${
                  filterSeverity === 'yellow'
                    ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                    : 'text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>Warnings ({yellowCount})</span>
              </button>
            )}
          </div>
        )}

        {/* ISSUES LIST */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {filteredIssues.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <svg className="w-10 h-10 mx-auto text-emerald-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-semibold text-gray-200">No issues found</p>
              <p className="text-xs text-gray-500 mt-1">Positions, Trades and Strategies Stops are consistent.</p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isRed = issue.severity === 'red'
              return (
                <div
                  key={issue.id}
                  className={`rounded-xl border p-4 transition-all ${
                    isRed
                      ? 'border-red-500/30 bg-red-950/20 hover:border-red-500/50'
                      : 'border-amber-500/30 bg-amber-950/20 hover:border-amber-500/50'
                  }`}
                >
                  {/* Top Bar of Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                        isRed
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {issue.title}
                      </span>
                      {issue.trade_code && (
                        <span className="text-sm font-bold text-white">
                          Trade #{issue.trade_code}
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-800 text-gray-200 border border-gray-700">
                        {issue.symbol}
                      </span>
                      {issue.instrument && (
                        <span className="text-xs text-gray-400">
                          {issue.instrument}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${
                      isRed ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {isRed ? 'Critical' : 'Warning'}
                    </span>
                  </div>

                  {/* Diagnostic Detail */}
                  <div className={`mt-2.5 text-xs text-gray-300 space-y-1 bg-black/35 p-3 rounded-lg border ${
                    isRed ? 'border-red-900/40' : 'border-amber-900/40'
                  }`}>
                    <p>
                      <strong className="text-gray-400">Discrepancy:</strong> {issue.description}
                    </p>
                    <p>
                      <strong className="text-gray-400">Impact:</strong> {issue.impact}
                    </p>
                    <p>
                      <strong className="text-gray-400">Recommended Action:</strong>{' '}
                      <span className="text-gray-200">{issue.suggestedAction}</span>
                    </p>
                  </div>

                  {/* Action Link */}
                  <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-gray-800/60">
                    {issue.type === 'GHOST_OPEN_TRADE' || issue.type === 'QUANTITY_MISMATCH' ? (
                      <Link
                        href="/dashboard/transactions"
                        onClick={onClose}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium transition-colors cursor-pointer"
                      >
                        Inspect in Transactions →
                      </Link>
                    ) : issue.type === 'MISSING_STRATEGY' ? (
                      <Link
                        href="/dashboard/transactions"
                        onClick={onClose}
                        className="text-xs px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white font-medium transition-colors cursor-pointer"
                      >
                        Assign Strategy in Transactions →
                      </Link>
                    ) : issue.type === 'ORPHAN_POSITION' ? (
                      <Link
                        href="/dashboard/positions"
                        onClick={onClose}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium transition-colors cursor-pointer"
                      >
                        View in Positions →
                      </Link>
                    ) : (
                      <Link
                        href="/dashboard/mk-tos"
                        onClick={onClose}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium transition-colors cursor-pointer"
                      >
                        Check MK-TOS Quotes →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-950/60 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Evaluated live on file upload & page visit</span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
