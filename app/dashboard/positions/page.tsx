import { connection } from 'next/server'
import { getPositions } from '../../../services/queries'
import PositionsTable from '../../../components/PositionsTable'
import HistorialArchivosPositions from '../../../components/HistorialArchivosPositions'
import { formatearFecha } from '../../../lib/formatters'
import { createClientSSR } from '../../../lib/supabaseServer'

export const instant = false

export default async function PositionsPage() {
  await connection()
  const supabase = await createClientSSR()

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