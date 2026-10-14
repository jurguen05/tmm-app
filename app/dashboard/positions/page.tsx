import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { getPositions } from '../../../services/queries'
import PositionsTable from '../../../components/PositionsTable'
import HistorialArchivosPositions from '../../../components/HistorialArchivosPositions'
import { formatearFecha } from '../../../lib/formatters'

export const instant = false

export default async function PositionsPage() {
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

  const posiciones = await getPositions(supabase)
  const statementDate = posiciones.length > 0 ? posiciones[0].statement_date : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Positions</h1>
          {statementDate && (
            <p className="text-lg text-gray-600 mt-2">
              Date: <span className="text-xl font-bold text-indigo-600">{formatearFecha(statementDate)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mb-8">
        <HistorialArchivosPositions />
      </div>

      <PositionsTable posiciones={posiciones} />
    </div>
  )
}