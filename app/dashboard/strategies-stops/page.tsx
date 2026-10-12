import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import StrategiesStopsTable from '../../../components/StrategiesStopsTable'

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

  const { data: positions } = await supabase.from('positions').select('*')

  let consolidado: any[] = []

  if (positions && positions.length > 0) {
    const uniqueKeys = positions.map(p => p.unique_key)
    
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, strategies(name)') 
      .in('unique_key', uniqueKeys)

    consolidado = positions.map((pos) => {
      const txsDelCodigo = transactions?.filter(t => t.unique_key === pos.unique_key) || []
      
      const txsOpen = txsDelCodigo.filter(t => t.position_status === 'Open' || t.position_status === 'open')
      const txsOpenOrdenadas = txsOpen.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      const trade_code = txsOpenOrdenadas.length > 0 ? txsOpenOrdenadas[0].trade_code : '-'
      const strategy = txsOpenOrdenadas.length > 0 ? (txsOpenOrdenadas[0].strategies?.name || 'S/D') : 'S/D'

      const txsDelTradeActual = txsDelCodigo.filter(t => String(t.trade_code) === String(trade_code))
      const txsOrdenadasFechas = [...txsDelTradeActual].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const primeraCompra = txsOrdenadasFechas.find(t => t.amount < 0) || txsOrdenadasFechas[0]
      
      const entryPrice = primeraCompra ? (primeraCompra.stock_entry_price || primeraCompra.price || 0) : 0
      const lastPrice = pos.stock_last || 0

      let rentabilidad = 0
      if (entryPrice > 0 && lastPrice > 0) {
        rentabilidad = (lastPrice / entryPrice) - 1
      }

      return {
        id: pos.id,
        trade_code: trade_code,
        symbol: pos.symbol,
        strategy: strategy,
        entryPrice: entryPrice,
        lastPrice: lastPrice,
        stop: '-', 
        rentabilidad: rentabilidad
      }
    })
    consolidado.sort((a, b) => a.symbol.localeCompare(b.symbol))
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
