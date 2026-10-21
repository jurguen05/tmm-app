'use client'

import { useState, useEffect, useCallback } from 'react'
import { ConsistencyAuditResult } from '../types'
import ConsistencyModal from './ConsistencyModal'

interface ConsistencyAlertBadgeProps {
  initialAudit?: ConsistencyAuditResult | null
}

export default function ConsistencyAlertBadge({ initialAudit }: ConsistencyAlertBadgeProps) {
  const [audit, setAudit] = useState<ConsistencyAuditResult | null>(initialAudit || null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fetchAudit = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/consistency-audit', { cache: 'no-store' })
      if (!res.ok) throw new Error('Audit request failed')
      const data: ConsistencyAuditResult = await res.json()
      setAudit(data)
    } catch (err) {
      console.warn('[ConsistencyAlertBadge] Failed to fetch audit:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // If not provided from SSR, fetch on mount
    if (!initialAudit) {
      fetchAudit()
    }

    // Listen for portfolio data changes (e.g. after CSV uploads)
    const handleDataChanged = () => {
      fetchAudit()
    }

    window.addEventListener('tmm:portfolio-data-changed', handleDataChanged)
    return () => {
      window.removeEventListener('tmm:portfolio-data-changed', handleDataChanged)
    }
  }, [fetchAudit, initialAudit])

  // If no issues, keep the navbar clean
  if (!audit || !audit.hasIssues || audit.totalCount === 0) {
    return (
      <ConsistencyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        audit={audit}
        onRefresh={fetchAudit}
        isRefreshing={isLoading}
      />
    )
  }

  const isRed = audit.maxSeverity === 'red'

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        title={`${audit.totalCount} consistency issue(s) detected. Click to inspect details.`}
        className={`group relative flex items-center gap-2 px-2.5 py-1 rounded-full transition-all cursor-pointer shadow-sm active:scale-95 ${
          isRed
            ? 'bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 hover:border-red-500/70 text-red-300'
            : 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-500/70 text-amber-300'
        }`}
      >
        {/* Pulsing Dot */}
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isRed ? 'bg-red-400' : 'bg-amber-400'
          }`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${
            isRed ? 'bg-red-500' : 'bg-amber-500'
          }`}></span>
        </span>

        {/* Word "Issue" as requested */}
        <span className="text-xs font-semibold tracking-wide">
          Issue
        </span>
      </button>

      <ConsistencyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        audit={audit}
        onRefresh={fetchAudit}
        isRefreshing={isLoading}
      />
    </>
  )
}
