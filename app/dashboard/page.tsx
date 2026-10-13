import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import Link from 'next/link'
import { getDashboardSummaryCounts } from '../../services/queries'

export const instant = false

export default async function DashboardPage() {
  await connection()
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const {
    positionsCount,
    transactionsCount,
    quotesCount,
    strategiesCount
  } = await getDashboardSummaryCounts(supabase)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Summary</h1>
        <p className="text-sm text-gray-500 mt-1">
          Trading Management System &bull; System Overview
        </p>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Positions */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Positions</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{positionsCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            📊
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Transactions</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{transactionsCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
            💳
          </div>
        </div>

        {/* Market Quotes */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Market Quotes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{quotesCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
            📈
          </div>
        </div>

        {/* Active Strategies */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Strategies</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{strategiesCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
            🎯
          </div>
        </div>
      </div>

      {/* QUICK MODULE ACCESS CARDS */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-4">Modules & Navigation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Strategies Stops Card */}
          <Link
            href="/dashboard/strategies-stops"
            className="group block p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Strategies Stops</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Active positions consolidated with strategies, stops & profitability</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Transactions Card */}
          <Link
            href="/dashboard/transactions"
            className="group block p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💳</span>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Transactions</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Review and manage transaction logs, strategy allocations and prices</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Positions Card */}
          <Link
            href="/dashboard/positions"
            className="group block p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Positions</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Position statements snapshots from ThinkorSwim platform</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* MK-TOS Card */}
          <Link
            href="/dashboard/mk-tos"
            className="group block p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📈</span>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">MK-TOS</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Daily quote statements, moving averages and market depth metrics</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}