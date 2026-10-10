'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function DashboardHome() {
  const [nombre, setNombre] = useState<string>('')

  useEffect(() => {
    // Obtenemos el mail del usuario para saludarlo (opcional)
    const obtenerUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setNombre(user.email.split('@')[0]) // Usa la primera parte del mail
      }
    }
    obtenerUsuario()
  }, [])

  return (
    <div className="p-8">
      <div className="max-w-[95%] mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Hola, {nombre || 'Operador'} 👋</h1>
          <p className="text-gray-500 mt-1">Este es el estado general de tu sistema hoy.</p>
        </div>

        {/* TARJETAS DE MÉTRICAS (KPIs) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Tarjeta 1 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Invertido</h3>
            <p className="text-3xl font-bold text-gray-900">$0.00</p>
            <div className="mt-2 text-sm text-green-600 font-medium">
              +0.00% este mes
            </div>
          </div>

          {/* Tarjeta 2 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Posiciones Abiertas</h3>
            <p className="text-3xl font-bold text-indigo-600">0</p>
            <div className="mt-2 text-sm text-gray-500">
              Operaciones activas
            </div>
          </div>

          {/* Tarjeta 3 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Operaciones Cerradas</h3>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <div className="mt-2 text-sm text-gray-500">
              Histórico total
            </div>
          </div>

        </div>

        {/* SECCIÓN DE PRÓXIMOS PASOS / ATAJOS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Accesos Rápidos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <a href="/dashboard/transactions" className="block p-4 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50 transition-colors">
              <h3 className="font-semibold text-indigo-700">Subir Transacciones</h3>
              <p className="text-sm text-gray-500 mt-1">Importá tu CSV del broker para procesar nuevas operaciones.</p>
            </a>

            <a href="/dashboard/positions" className="block p-4 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50 transition-colors">
              <h3 className="font-semibold text-indigo-700">Ver Posiciones</h3>
              <p className="text-sm text-gray-500 mt-1">Controlá el estado de tus operaciones abiertas y cerradas.</p>
            </a>

            <a href="/dashboard/mk-tos" className="block p-4 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50 transition-colors">
              <h3 className="font-semibold text-indigo-700">ThinkOrSwim Scanners</h3>
              <p className="text-sm text-gray-500 mt-1">Revisá las señales técnicas de tus estrategias mecánicas.</p>
            </a>
            
          </div>
        </div>

      </div>
    </div>
  )
}