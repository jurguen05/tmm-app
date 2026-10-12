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
        
        <nav className="flex-1 px-4 space-y-4 mt-2">
          {/* 1. SUMMARY */}
          <div>
            <Link 
              href="/dashboard"
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
          </div>

          {/* 2. STRATEGIES STOPS & DEPENDENT TREE */}
          <div className="space-y-1">
            {/* Header del nodo Strategies Stops (Navega a /dashboard/strategies-stops) */}
            <div className={`flex items-center justify-between rounded-lg transition-colors ${
              pathname === '/dashboard/strategies-stops' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-gray-800/60'
            }`}>
              <Link
                href="/dashboard/strategies-stops"
                onClick={() => setStrategiesExpanded(true)}
                className={`flex-1 px-3 py-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors ${
                  pathname === '/dashboard/strategies-stops'
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <svg className={`w-3.5 h-3.5 ${pathname === '/dashboard/strategies-stops' ? 'text-white' : 'text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                  className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                  className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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