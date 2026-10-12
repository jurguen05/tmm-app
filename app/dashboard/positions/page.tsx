import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { getPositions } from '../../../services/queries'
import UploadPositionsCsv from '../../../components/UploadPositionsCsv'
import PositionsTable from '../../../components/PositionsTable'
import HistorialArchivosPositions from '../../../components/HistorialArchivosPositions'
import { formatearFecha } from '../../../lib/formatters'

export const instant = false

export default async function PositionsPage() {
  await connection()
  // 1. Instanciamos el cliente SSR
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

  // 2. Fetching directo en el servidor (asegurate de actualizar getPositions para recibir supabase como parámetro)
  const posiciones = await getPositions(supabase)
  
  const statementDate = posiciones.length > 0 ? posiciones[0].statement_date : null;

  // 3. Ya no pasamos "onDatosActualizados" a los hijos
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <UploadPositionsCsv />
        <HistorialArchivosPositions />
      </div>

      <PositionsTable posiciones={posiciones} />
    </div>
  )
}