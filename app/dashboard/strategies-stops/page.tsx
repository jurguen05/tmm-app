import { connection, after } from 'next/server'
import StrategiesStopsTable from '../../../components/StrategiesStopsTable'
import { 
  getConsolidatedTradingSourceData,
  updateTradesMaxStockPrices,
  updateTradesWeekendTraderFlags,
  updateTradesRatchetStops,
  autoArchiveOldMkTosFiles,
  getStrategiesStopsFreshness,
  FreshnessStatus
} from '../../../services/queries'
import { consolidarStrategiesStops } from '../../../lib/strategiesCalculator'
import { formatearFecha } from '../../../lib/formatters'
import { createClientSSR } from '../../../lib/supabaseServer'

export const instant = false

export default async function StrategiesStopsPage() {
  await connection()
  const supabase = await createClientSSR()

  const { positions, transactions, mkTosQuotes, trades, strategies, spyCloses } =
    await getConsolidatedTradingSourceData(supabase)

  let consolidado: ReturnType<typeof consolidarStrategiesStops> = []
  let freshness: FreshnessStatus | null = null

  if (positions && positions.length > 0) {
    const freshnessData = await getStrategiesStopsFreshness(supabase, positions).catch(() => null)
    freshness = freshnessData

    consolidado = consolidarStrategiesStops(positions, transactions, mkTosQuotes, trades, strategies, spyCloses)

    // Persistir max_stock_price, max_stock_price_date y weekend_trader_flag en la tabla trades
    const tradesWithMax = consolidado
      .filter(c => c.trade_code && c.trade_code !== '-')
      .map(c => ({
        trade_code: Number(c.trade_code),
        max_stock_price: c.max_stock_price ?? null,
        max_stock_price_date: c.max_stock_price_date ?? null,
        weekend_trader_flag: c.weekend_trader_flag
      }));

    // Persistir ratchet_stop para New Yearly Highs y 100-day-High en trades abiertos
    const tradesWithRatchet = consolidado
      .filter(c => c.ratchet_stop !== null && c.ratchet_stop !== undefined && c.ratchet_stop > 0 && c.trade_code && c.trade_code !== '-')
      .map(c => ({
        trade_code: Number(c.trade_code),
        ratchet_stop: c.ratchet_stop!
      }));

    // Persistir irreversiblemente el flag de Weekend Trader en trades abiertos cuando sea true
    const weekendTradesToFlag = consolidado
      .filter(c => c.weekend_trader_flag === true && c.trade_code && c.trade_code !== '-')
      .map(c => Number(c.trade_code));

    // Las escrituras corren después de enviar la respuesta para no bloquear el render
    after(async () => {
      let maxUpdatesFailed = 0
      if (tradesWithMax.length > 0) {
        maxUpdatesFailed = await updateTradesMaxStockPrices(supabase, tradesWithMax).catch(() => 1)
      }
      if (weekendTradesToFlag.length > 0) {
        await updateTradesWeekendTraderFlags(supabase, weekendTradesToFlag).catch(() => {})
      }
      if (tradesWithRatchet.length > 0) {
        await updateTradesRatchetStops(supabase, tradesWithRatchet).catch(() => {})
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

      <StrategiesStopsTable datos={consolidado} cargando={false} />
    </div>
  )
}
