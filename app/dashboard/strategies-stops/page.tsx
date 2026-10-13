import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import StrategiesStopsTable from '../../../components/StrategiesStopsTable'
import { getPositions, getTransactionsByUniqueKeys, getLatestMkTosQuotes, getTransactionsByTradeCodes, getOpenTrades } from '../../../services/queries'
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
  let missingOpenTrades: any[] = []

  if (positions && positions.length > 0) {
    const uniqueKeys = positions.map(p => p.unique_key).filter(Boolean)
    const keysToQuery = new Set<string>()
    for (const k of uniqueKeys) {
      keysToQuery.add(k)
      // Generar variante con día/mes invertido si es una opción
      const match = k.trim().match(/^([A-Z]+)-(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/)
      if (match) {
        const ticker = match[1]
        const p1 = match[2].padStart(2, '0')
        const p2 = match[3].padStart(2, '0')
        const yyyy = match[4]
        const rest = match[5]
        keysToQuery.add(`${ticker}-${p2}/${p1}/${yyyy} ${rest}`)
      }
    }

    const symbols = Array.from(new Set(positions.map(p => p.symbol).filter(Boolean)))
    
    // 1. Obtener transacciones directamente vinculadas, cotizaciones MK-TOS y trades maestros
    const [initialTxs, mkTosQuotes, openTrades] = await Promise.all([
      getTransactionsByUniqueKeys(supabase, Array.from(keysToQuery)),
      getLatestMkTosQuotes(supabase, symbols),
      getOpenTrades(supabase)
    ])

    // 2. Extraer los trade_codes activos para traer el historial completo del trade (incluidas opciones o compras iniciales)
    const activeTradeCodes = Array.from(new Set(
      initialTxs
        .filter(t => t.position_status?.toLowerCase() === 'open' && t.trade_code)
        .map(t => Number(t.trade_code))
        .filter(c => !isNaN(c) && c > 0)
    ))

    let allRelevantTransactions = initialTxs
    if (activeTradeCodes.length > 0) {
      const fullTradeTxs = await getTransactionsByTradeCodes(supabase, activeTradeCodes)
      const txMap = new Map<string, typeof initialTxs[0]>()
      initialTxs.forEach(t => txMap.set(t.id, t))
      fullTradeTxs.forEach(t => txMap.set(t.id, t))
      allRelevantTransactions = Array.from(txMap.values())
    }

    consolidado = consolidarStrategiesStops(positions, allRelevantTransactions, mkTosQuotes, openTrades)

    // Detectar trades marcados como 'Open' pero ausentes en el Position Statement de hoy (Opción 2 con aviso)
    const activeConsolidatedCodes = new Set(
      consolidado
        .map(c => String(c.trade_code))
        .filter(c => c && c !== '-')
    )
    const activePositionSymbols = new Set(
      positions.map(p => p.symbol?.trim().toUpperCase()).filter(Boolean)
    )

    missingOpenTrades = (openTrades || []).filter(tr => {
      const matchCode = tr.trade_code && activeConsolidatedCodes.has(String(tr.trade_code))
      const matchSymbol = tr.symbol && activePositionSymbols.has(tr.symbol.trim().toUpperCase())
      return !matchCode && !matchSymbol
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Strategies Stops</h1>
        <p className="text-gray-600 mt-2">
          Daily Review: Active positions, stops and profitability.
        </p>
      </div>

      <StrategiesStopsTable datos={consolidado} cargando={false} missingTrades={missingOpenTrades} />
    </div>
  )
}
