import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import StrategiesStopsTable from '../../../components/StrategiesStopsTable'
import { getPositions, getTransactionsByUniqueKeys } from '../../../services/queries'
import { consolidarStrategiesStops } from '../../../lib/strategiesCalculator'

export const instant = false

export default async function StrategiesStopsPage() {
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

  const positions = await getPositions(supabase)
  let consolidado: ReturnType<typeof consolidarStrategiesStops> = []

  if (positions && positions.length > 0) {
    const uniqueKeys = positions.map(p => p.unique_key)
    const transactions = await getTransactionsByUniqueKeys(supabase, uniqueKeys)
    consolidado = consolidarStrategiesStops(positions, transactions)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Strategies Stops</h1>
        <p className="text-gray-600 mt-2">
          Daily Review: Active positions, stops and profitability.
        </p>
      </div>
      <StrategiesStopsTable datos={consolidado} cargando={false} />
    </div>
  )
}
