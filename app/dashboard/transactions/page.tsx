import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { getUserProfile, getTransactions, getActiveStrategies } from '../../../services/queries'
import UploadTransactionsCsv from '../../../components/UploadTransactionsCsv'
import HistorialArchivosTransactions from '../../../components/HistorialArchivosTransactions'
import TransactionsTableClient from '../../../components/TransactionsTableClient'

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

  // 2. Fetching con el cliente SSR inyectado
  const perfil = await getUserProfile(supabase, user.id)

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

  // Si es admin (rol 1), traemos los datos
  const transacciones = await getTransactions(supabase)
  const estrategias = await getActiveStrategies(supabase)

  return (
    <div className="p-8">
      <div className="max-w-[95%] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Transactions</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UploadTransactionsCsv />
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