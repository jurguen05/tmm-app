'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import QuickUploadModal from '../../components/QuickUploadModal'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [strategiesExpanded, setStrategiesExpanded] = useState(true)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* MENÚ LATERAL */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">TMM System</h2>
            <p className="text-xs text-gray-400 mt-1">Trading Management</p>
          </div>
          <button
            onClick={() => setModalAbierto(true)}
            title="Upload CSVs"
            className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-2xl rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex-shrink-0"
          >
            +
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-6 mt-2 overflow-y-auto">
          {/* CATEGORY 1: PORTFOLIO & TRADING */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-gray-400 font-semibold text-xs tracking-wider uppercase">
              Portfolio & Trading
            </div>

            {/* Summary */}
            <Link 
              href="/dashboard"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Summary</span>
            </Link>

            {/* Strategies Stops & Dependent Subtree */}
            <div className="space-y-1">
              <div className={`flex items-center justify-between rounded-lg transition-colors ${
                pathname === '/dashboard/strategies-stops' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-gray-800/60'
              }`}>
                <Link
                  href="/dashboard/strategies-stops"
                  onClick={() => setStrategiesExpanded(true)}
                  className={`flex-1 px-3 py-2 flex items-center gap-2 text-sm font-medium rounded-lg transition-colors ${
                    pathname === '/dashboard/strategies-stops'
                      ? 'text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <svg className={`w-4 h-4 ${pathname === '/dashboard/strategies-stops' ? 'text-white' : 'text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span>Strategies Stops</span>
                </Link>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setStrategiesExpanded(!strategiesExpanded)
                  }}
                  className={`p-2 rounded-r-lg hover:bg-black/20 transition-colors cursor-pointer ${
                    pathname === '/dashboard/strategies-stops' ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                  title={strategiesExpanded ? "Collapse sub-menu" : "Expand sub-menu"}
                >
                  <svg 
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      strategiesExpanded ? 'rotate-90' : ''
                    }`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Submenú colapsable con línea vertical de árbol */}
              {strategiesExpanded && (
                <div className="relative pl-4 ml-3 border-l-2 border-gray-700/60 space-y-1 mt-1 transition-all">
                  {/* Transactions */}
                  <Link 
                    href="/dashboard/transactions"
                    className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === '/dashboard/transactions'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>Transactions</span>
                  </Link>

                  {/* Positions */}
                  <Link 
                    href="/dashboard/positions"
                    className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === '/dashboard/positions'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Positions</span>
                  </Link>

                  {/* Mk-Tos */}
                  <Link 
                    href="/dashboard/mk-tos"
                    className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === '/dashboard/mk-tos'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>Mk-Tos</span>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* CATEGORY 2: RISK MANAGEMENT */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-gray-400 font-semibold text-xs tracking-wider uppercase">
              Risk Management
            </div>

            {/* Portfolio Risk */}
            <Link 
              href="/dashboard/portfolio-risk"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/dashboard/portfolio-risk'
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Portfolio Risk</span>
            </Link>

            {/* Risk Strategies */}
            <Link 
              href="/dashboard/risk-strategies"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/dashboard/risk-strategies'
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Risk Strategies</span>
            </Link>

            {/* Drawdown */}
            <Link 
              href="/dashboard/drawdown"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/dashboard/drawdown'
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
              <span>Drawdown</span>
            </Link>
          </div>

          {/* CATEGORY 3: SIMULATION & HEDGING */}
          <div className="space-y-1">
            <div className="px-3 mb-2 text-gray-400 font-semibold text-xs tracking-wider uppercase">
              Simulation & Hedging
            </div>

            {/* Hedging */}
            <Link 
              href="/dashboard/hedging"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/dashboard/hedging'
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Hedging</span>
            </Link>

            {/* Monte Carlo */}
            <Link 
              href="/dashboard/monte-carlo"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/dashboard/monte-carlo'
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <span>Monte Carlo</span>
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm font-medium text-red-400 hover:bg-gray-800 hover:text-red-300 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* MODAL DE CARGA RÁPIDA DE CSVs */}
      <QuickUploadModal 
        isOpen={modalAbierto} 
        onClose={() => setModalAbierto(false)} 
      />
    </div>
  )
}