import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { getUserProfile, getTransactions, getActiveStrategies } from '../../../services/queries'
import HistorialArchivosTransactions from '../../../components/HistorialArchivosTransactions'
import TransactionsTableClient from '../../../components/TransactionsTableClient'
import { formatearFecha } from '../../../lib/formatters'

export const instant = false

export default async function TransactionsPage() {
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

  // 1. Validar usuario en el servidor de forma segura
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return <div>No autorizado</div>
  }

  // 2. Ejecutar validación de perfil y fetching en paralelo (últimas 50 transacciones para control visual)
  const [perfil, transacciones, estrategias] = await Promise.all([
    getUserProfile(supabase, user.id),
    getTransactions(supabase, 50),
    getActiveStrategies(supabase)
  ])

  const statementDate = transacciones.length > 0 ? transacciones[0].date : null;

  if (perfil?.role_id === 2) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg text-center border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">¡Bienvenido a TMM!</h1>
          <p className="text-gray-600">
            Tu perfil ha sido validado correctamente. Las transacciones son gestionadas exclusivamente por nuestros operadores.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Transactions</h1>
          {statementDate && (
            <p className="text-lg text-gray-600 mt-2">
              Date: <span className="text-xl font-bold text-indigo-600">{formatearFecha(statementDate)}</span>
            </p>
          )}
        </div>
        
        <div className="mb-6">
          <HistorialArchivosTransactions />
        </div>

        {/* Delegamos toda la interactividad al Client Component envoltorio */}
        <TransactionsTableClient 
          initialTransactions={transacciones} 
          estrategias={estrategias} 
        />
      </div>
    </div>
  )
}