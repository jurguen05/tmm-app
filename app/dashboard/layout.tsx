'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import QuickUploadModal from '../../components/QuickUploadModal'
import ConsistencyAlertBadge from '../../components/ConsistencyAlertBadge'
import NavSection from '../../components/NavSection'
import NavSubmenu, { NavSubmenuItem } from '../../components/NavSubmenu'

type TopCategoryKey = 'portfolio' | 'contracts'
type SubmenuKey = 'strategies' | 'risk' | 'simulation'

const DEFAULT_CATEGORIES: Record<TopCategoryKey, boolean> = {
  portfolio: true,
  contracts: true,
}

const DEFAULT_SUBMENUS: Record<SubmenuKey, boolean> = {
  strategies: true,
  risk: true,
  simulation: true,
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [userRole, setUserRole] = useState<number | null>(null)

  const [openCategories, setOpenCategories] = useState<Record<TopCategoryKey, boolean>>(DEFAULT_CATEGORIES)
  const [openSubmenus, setOpenSubmenus] = useState<Record<SubmenuKey, boolean>>(DEFAULT_SUBMENUS)

  // Load persisted category and submenu state on mount
  useEffect(() => {
    try {
      const savedCats = localStorage.getItem('tmm_nav_categories')
      if (savedCats) {
        setOpenCategories(prev => ({ ...prev, ...JSON.parse(savedCats) }))
      }
      const savedSubs = localStorage.getItem('tmm_nav_submenus')
      if (savedSubs) {
        setOpenSubmenus(prev => ({ ...prev, ...JSON.parse(savedSubs) }))
      }
    } catch (e) {
      console.warn('Failed to load navigation state from localStorage:', e)
    }
  }, [])

  const toggleCategory = (key: TopCategoryKey) => {
    setOpenCategories(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem('tmm_nav_categories', JSON.stringify(next))
      } catch (e) {
        console.warn('Failed to save category state:', e)
      }
      return next
    })
  }

  const toggleSubmenu = (key: SubmenuKey) => {
    setOpenSubmenus(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem('tmm_nav_submenus', JSON.stringify(next))
      } catch (e) {
        console.warn('Failed to save submenu state:', e)
      }
      return next
    })
  }

  // Active status detection
  const isStrategiesActive =
    pathname === '/dashboard/strategies-stops' ||
    pathname.startsWith('/dashboard/transactions') ||
    pathname.startsWith('/dashboard/positions') ||
    pathname.startsWith('/dashboard/mk-tos')

  const isRiskActive =
    pathname.startsWith('/dashboard/portfolio-risk') ||
    pathname.startsWith('/dashboard/risk-strategies') ||
    pathname.startsWith('/dashboard/drawdown')

  const isSimulationActive =
    pathname.startsWith('/dashboard/hedging') ||
    pathname.startsWith('/dashboard/monte-carlo')

  const isPortfolioActive =
    pathname === '/dashboard' ||
    isStrategiesActive ||
    isRiskActive ||
    isSimulationActive

  const isContractsActive =
    pathname === '/dashboard/contracts' ||
    (pathname.startsWith('/dashboard/contracts/') &&
      !pathname.startsWith('/dashboard/contracts/contacts') &&
      !pathname.startsWith('/dashboard/contracts/originators')) ||
    pathname.startsWith('/dashboard/contracts/originators')

  const isContactsActive = pathname === '/dashboard/contracts/contacts'

  // Auto-expand category and sub-menus when an active route is visited
  useEffect(() => {
    if (isPortfolioActive) {
      setOpenCategories(prev => {
        if (!prev.portfolio) {
          const next = { ...prev, portfolio: true }
          try { localStorage.setItem('tmm_nav_categories', JSON.stringify(next)) } catch (_) {}
          return next
        }
        return prev
      })
      if (isStrategiesActive) {
        setOpenSubmenus(prev => {
          if (!prev.strategies) {
            const next = { ...prev, strategies: true }
            try { localStorage.setItem('tmm_nav_submenus', JSON.stringify(next)) } catch (_) {}
            return next
          }
          return prev
        })
      }
      if (isRiskActive) {
        setOpenSubmenus(prev => {
          if (!prev.risk) {
            const next = { ...prev, risk: true }
            try { localStorage.setItem('tmm_nav_submenus', JSON.stringify(next)) } catch (_) {}
            return next
          }
          return prev
        })
      }
      if (isSimulationActive) {
        setOpenSubmenus(prev => {
          if (!prev.simulation) {
            const next = { ...prev, simulation: true }
            try { localStorage.setItem('tmm_nav_submenus', JSON.stringify(next)) } catch (_) {}
            return next
          }
          return prev
        })
      }
    } else if (isContractsActive) {
      setOpenCategories(prev => {
        if (!prev.contracts) {
          const next = { ...prev, contracts: true }
          try { localStorage.setItem('tmm_nav_categories', JSON.stringify(next)) } catch (_) {}
          return next
        }
        return prev
      })
    }
  }, [pathname, isPortfolioActive, isStrategiesActive, isRiskActive, isSimulationActive, isContractsActive])

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role_id')
            .eq('id', user.id)
            .single()
          if (profile) {
            setUserRole(profile.role_id)
          }
        }
      } catch (err) {
        console.error('Error fetching user role:', err)
      }
    }
    fetchUserRole()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Submenu items definitions
  const strategiesItems: NavSubmenuItem[] = [
    { label: 'Transactions', href: '/dashboard/transactions', dotColor: 'bg-indigo-400' },
    { label: 'Positions', href: '/dashboard/positions', dotColor: 'bg-emerald-400' },
    { label: 'Mk-Tos', href: '/dashboard/mk-tos', dotColor: 'bg-amber-400' },
  ]

  const riskItems: NavSubmenuItem[] = [
    { label: 'Portfolio Risk', href: '/dashboard/portfolio-risk', dotColor: 'bg-rose-400' },
    { label: 'Risk Strategies', href: '/dashboard/risk-strategies', dotColor: 'bg-amber-400' },
    { label: 'Drawdown', href: '/dashboard/drawdown', dotColor: 'bg-red-400' },
  ]

  const simulationItems: NavSubmenuItem[] = [
    { label: 'Hedging', href: '/dashboard/hedging', dotColor: 'bg-teal-400' },
    { label: 'Monte Carlo', href: '/dashboard/monte-carlo', dotColor: 'bg-cyan-400' },
  ]

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* MENÚ LATERAL */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">TMM System</h2>
            <ConsistencyAlertBadge />
          </div>
          {userRole !== 2 && (
          <button
            onClick={() => setModalAbierto(true)}
            title="Upload CSVs"
            className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-2xl rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex-shrink-0"
          >
            +
          </button>
          )}
        </div>
        
        <nav className="flex-1 px-4 space-y-4 mt-2 overflow-y-auto">
          {/* SI EL USUARIO ES INVERSOR (ROLE_ID === 2), SOLO VE SU PORTAL */}
          {userRole === 2 ? (
            <div className="space-y-1">
              <div className="px-3 mb-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase">
                Investor Portal
              </div>
              <Link 
                href="/dashboard/contracts"
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith('/dashboard/contracts')
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>My Contract</span>
              </Link>
            </div>
          ) : (
            <>
              {/* TOP LEVEL 1: PORTFOLIO & TRADING (COLLAPSIBLE CATEGORY) */}
              <NavSection
                title="Portfolio & Trading"
                isOpen={openCategories.portfolio}
                onToggle={() => toggleCategory('portfolio')}
                hasActiveChild={isPortfolioActive}
              >
                {/* 1. Summary */}
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

                {/* 2. Strategies Stops & Subtree */}
                <NavSubmenu
                  title="Strategies Stops"
                  icon={
                    <svg className={`w-4 h-4 ${pathname === '/dashboard/strategies-stops' ? 'text-white' : 'text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  }
                  isExpanded={openSubmenus.strategies}
                  onToggle={() => toggleSubmenu('strategies')}
                  isActive={isStrategiesActive}
                  mainHref="/dashboard/strategies-stops"
                  items={strategiesItems}
                  currentPathname={pathname}
                />

                {/* 3. Risk Management & Subtree */}
                <NavSubmenu
                  title="Risk Management"
                  icon={
                    <svg className={`w-4 h-4 ${isRiskActive ? 'text-white' : 'text-rose-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  }
                  isExpanded={openSubmenus.risk}
                  onToggle={() => toggleSubmenu('risk')}
                  isActive={isRiskActive}
                  items={riskItems}
                  currentPathname={pathname}
                />

                {/* 4. Simulation Management & Subtree */}
                <NavSubmenu
                  title="Simulation Management"
                  icon={
                    <svg className={`w-4 h-4 ${isSimulationActive ? 'text-white' : 'text-teal-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  }
                  isExpanded={openSubmenus.simulation}
                  onToggle={() => toggleSubmenu('simulation')}
                  isActive={isSimulationActive}
                  items={simulationItems}
                  currentPathname={pathname}
                />
              </NavSection>

              {/* TOP LEVEL 2: CAPITAL & CONTRACTS (COLLAPSIBLE CATEGORY) */}
              <NavSection
                title="Capital & Contracts"
                isOpen={openCategories.contracts}
                onToggle={() => toggleCategory('contracts')}
                hasActiveChild={isContractsActive}
              >
                {/* Contracts */}
                <Link 
                  href="/dashboard/contracts"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isContractsActive && !pathname.startsWith('/dashboard/contracts/originators')
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Contracts</span>
                </Link>

                {/* Originators */}
                <Link 
                  href="/dashboard/contracts/originators"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === '/dashboard/contracts/originators'
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Originators</span>
                </Link>
              </NavSection>

              {/* TOP LEVEL 3: CONTACTS & ENTITIES (AT THE SAME LEVEL AS PORTFOLIO & CAPITAL) */}
              <div className="pt-1">
                <Link 
                  href="/dashboard/contracts/contacts"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isContactsActive
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Contacts & Entities</span>
                </Link>
              </div>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm font-medium text-red-400 hover:bg-gray-800 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
        {/* TOP NAVBAR HEADER */}
        <header className="h-14 bg-white/90 backdrop-blur-sm border-b border-gray-200/80 px-8 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">TMM System</span>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-700 capitalize">
              {pathname === '/dashboard' ? 'Overview' : pathname?.replace('/dashboard/', '').replace(/-/g, ' ')}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* MODAL DE CARGA RÁPIDA DE CSVs */}
      <QuickUploadModal 
        isOpen={modalAbierto} 
        onClose={() => setModalAbierto(false)} 
      />
    </div>
  )
}
