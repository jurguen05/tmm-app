'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const menuItems = [
    { nombre: 'Summary', ruta: '/dashboard' },
    { nombre: 'Transactions', ruta: '/dashboard/transactions' },
    { nombre: 'Positions', ruta: '/dashboard/positions' },
    { nombre: 'Mk-Tos', ruta: '/dashboard/mk-tos' },
  ]

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* MENÚ LATERAL */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">TMM System</h2>
          <p className="text-xs text-gray-400 mt-1">Trading Management</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => {
            // Verifica si la ruta actual coincide exactamente para pintar el botón
            const activo = pathname === item.ruta
            return (
              <Link 
                key={item.ruta} 
                href={item.ruta}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activo 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.nombre}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm font-medium text-red-400 hover:bg-gray-800 hover:text-red-300 rounded-lg transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}