import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection, after } from 'next/server'
import StrategiesStopsTable from '../../../components/StrategiesStopsTable'
import { 
  getPositions, 
  getTransactionsByUniqueKeys, 
  getLatestMkTosQuotes, 
  getTransactionsByTradeCodes, 
  getOpenTrades,
  getActiveStrategies,
  updateTradesMaxStockPrices,
  updateTradesWeekendTraderFlags,
  syncTradesForCodes,
  getSpyDailyCloses,
  autoArchiveOldMkTosFiles,
  getStrategiesStopsFreshness,
  FreshnessStatus
} from '../../../services/queries'
import { consolidarStrategiesStops } from '../../../lib/strategiesCalculator'
import { calcularEstadoTradeDesdeTransacciones } from '../../../lib/transactionsParser'
import { formatearFecha } from '../../../lib/formatters'

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

  // Independientes de positions: se lanzan en paralelo
  const [positions, openTrades, activeStrategies, spyCloses] = await Promise.all([
    getPositions(supabase),
    getOpenTrades(supabase),
    getActiveStrategies(supabase).catch(() => []),
    // Historial persistido de SPY vs SMA 10W (si la tabla aún no existe, se usa SPY de mk_tos_quotes)
    getSpyDailyCloses(supabase).catch(() => [])
  ])
  let consolidado: ReturnType<typeof consolidarStrategiesStops> = []
  let missingOpenTrades: any[] = []
  let freshness: FreshnessStatus | null = null

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

    // Asegurarse de incluir SPY para evaluar el filtro de mercado de Weekend Trader
    const symbols = Array.from(new Set([...positions.map(p => p.symbol).filter(Boolean), 'SPY']))

    // Pre-cargar el historial completo de los trades abiertos (por trade_code) en paralelo con el resto
    const prefetchedCodes = Array.from(new Set(
      (openTrades || [])
        .map(t => Number(t.trade_code))
        .filter(c => !isNaN(c) && c > 0)
    ))

    // 1. Obtener transacciones vinculadas, cotizaciones MK-TOS, historial de trades y frescura de archivos en paralelo
    const [initialTxs, mkTosQuotes, prefetchedTxs, freshnessData] = await Promise.all([
      getTransactionsByUniqueKeys(supabase, Array.from(keysToQuery)),
      getLatestMkTosQuotes(supabase, symbols),
      getTransactionsByTradeCodes(supabase, prefetchedCodes),
      getStrategiesStopsFreshness(supabase, positions).catch(() => null)
    ])
    freshness = freshnessData

    // 2. Solo si hay trade_codes activos que no estaban pre-cargados, traerlos (fallback)
    const prefetchedSet = new Set(prefetchedCodes)
    const missingTradeCodes = Array.from(new Set(
      initialTxs
        .filter(t => t.position_status?.toLowerCase() === 'open' && t.trade_code)
        .map(t => Number(t.trade_code))
        .filter(c => !isNaN(c) && c > 0 && !prefetchedSet.has(c))
    ))

    const extraTxs = missingTradeCodes.length > 0
      ? await getTransactionsByTradeCodes(supabase, missingTradeCodes)
      : []

    const txMap = new Map<string, typeof initialTxs[0]>()
    initialTxs.forEach(t => txMap.set(t.id, t))
    prefetchedTxs.forEach(t => txMap.set(t.id, t))
    extraTxs.forEach(t => txMap.set(t.id, t))
    const allRelevantTransactions = Array.from(txMap.values())

    consolidado = consolidarStrategiesStops(positions, allRelevantTransactions, mkTosQuotes, openTrades, activeStrategies, spyCloses)

    // Persistir max_stock_price, max_stock_price_date y weekend_trader_flag en la tabla trades
    const tradesWithMax = consolidado
      .filter(c => c.trade_code && c.trade_code !== '-')
      .map(c => ({
        trade_code: Number(c.trade_code),
        max_stock_price: c.max_stock_price ?? null,
        max_stock_price_date: c.max_stock_price_date ?? null,
        weekend_trader_flag: c.weekend_trader_flag
      }));

    // Persistir irreversiblemente el flag de Weekend Trader en trades abiertos cuando sea true
    const weekendTradesToFlag = consolidado
      .filter(c => c.weekend_trader_flag === true && c.trade_code && c.trade_code !== '-')
      .map(c => Number(c.trade_code));

    const codesToAutoClose: number[] = []

    // Indexar transacciones por trade_code para evaluar balance neto
    const txsByTradeCode = new Map<number, typeof prefetchedTxs>()
    allRelevantTransactions.forEach(t => {
      if (t.trade_code) {
        const c = Number(t.trade_code)
        if (!txsByTradeCode.has(c)) txsByTradeCode.set(c, [])
        txsByTradeCode.get(c)!.push(t)
      }
    })

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
      const c = Number(tr.trade_code)
      const tradeTxs = txsByTradeCode.get(c) || []

      // Si el historial de transacciones ya muestra que la posición neta es 0, el trade ya fue cerrado
      if (tradeTxs.length > 0 && calcularEstadoTradeDesdeTransacciones(tradeTxs) === 'Closed') {
        codesToAutoClose.push(c)
        return false
      }

      const matchCode = tr.trade_code && activeConsolidatedCodes.has(String(tr.trade_code))
      const matchSymbol = tr.symbol && activePositionSymbols.has(tr.symbol.trim().toUpperCase())
      return !matchCode && !matchSymbol
    })

    // Las escrituras corren después de enviar la respuesta para no bloquear el render
    after(async () => {
      let maxUpdatesFailed = 0
      if (tradesWithMax.length > 0) {
        maxUpdatesFailed = await updateTradesMaxStockPrices(supabase, tradesWithMax).catch(() => 1)
      }
      if (weekendTradesToFlag.length > 0) {
        await updateTradesWeekendTraderFlags(supabase, weekendTradesToFlag).catch(() => {})
      }
      if (codesToAutoClose.length > 0) {
        await syncTradesForCodes(supabase, codesToAutoClose).catch(() => {})
      }
      // Solo archivar automáticamente si la persistencia de picos no tuvo errores
      if (maxUpdatesFailed === 0) {
        await autoArchiveOldMkTosFiles(supabase).catch(() => {})
      }
    })
  }

  if (!freshness) {
    freshness = await getStrategiesStopsFreshness(supabase, positions).catch(() => null)
  }

  const getDotClass = (status?: 'green' | 'yellow' | 'gray') => {
    switch (status) {
      case 'green':
        return 'bg-emerald-500 ring-2 ring-emerald-200'
      case 'yellow':
        return 'bg-amber-400 ring-2 ring-amber-200'
      default:
        return 'bg-gray-300 ring-2 ring-gray-100'
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Strategies Stops</h1>

        {freshness && (
          <div className="mt-3 flex flex-wrap items-center gap-6 text-sm">
            {/* Positions */}
            <div 
              className="flex items-center gap-2 cursor-default select-none"
              title={freshness.positions.tooltip}
            >
              <span className={`w-2.5 h-2.5 rounded-full inline-block shadow-sm ${getDotClass(freshness.positions.status)}`} />
              <span className="text-gray-600 font-medium">Positions:</span>
              <span className="font-bold text-gray-900">{formatearFecha(freshness.positions.date) || '-'}</span>
            </div>

            {/* MK-TOS */}
            <div 
              className="flex items-center gap-2 cursor-default select-none"
              title={freshness.mkTos.tooltip}
            >
              <span className={`w-2.5 h-2.5 rounded-full inline-block shadow-sm ${getDotClass(freshness.mkTos.status)}`} />
              <span className="text-gray-600 font-medium">MK-TOS:</span>
              <span className="font-bold text-gray-900">{formatearFecha(freshness.mkTos.date) || '-'}</span>
            </div>

            {/* Transactions */}
            <div 
              className="flex items-center gap-2 cursor-default select-none"
              title={freshness.transactions.tooltip}
            >
              <span className={`w-2.5 h-2.5 rounded-full inline-block shadow-sm ${getDotClass(freshness.transactions.status)}`} />
              <span className="text-gray-600 font-medium">Transactions:</span>
              <span className="font-bold text-gray-900">{formatearFecha(freshness.transactions.date) || '-'}</span>
            </div>
          </div>
        )}
      </div>

      <StrategiesStopsTable datos={consolidado} cargando={false} missingTrades={missingOpenTrades} />
    </div>
  )
}
