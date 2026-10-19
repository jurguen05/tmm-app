import { connection } from 'next/server'
import { getHedgingSourceData } from '../../../services/queries'
import { calcularHedgingModule } from '../../../lib/hedgingCalculator'
import HedgingDashboard from '../../../components/HedgingDashboard'
import { createClientSSR } from '../../../lib/supabaseServer'

export const instant = false

export default async function HedgingPage() {
  await connection()
  const supabase = await createClientSSR()

  // Carga consolidada de fuentes de datos (posiciones, transacciones, trades, cotizaciones y cash)
  const {
    positions,
    transactions,
    mkTosQuotes,
    trades,
    strategies,
    spyCloses,
    cashBalance
  } = await getHedgingSourceData(supabase)

  // Cálculo puro server-side del presupuesto Spitznagel, auditoría de Puts y simulación Marian Shield v4.0
  const hedgingData = calcularHedgingModule(
    positions,
    transactions,
    cashBalance,
    mkTosQuotes,
    trades,
    strategies,
    spyCloses
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER DEL MÓDULO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🛡️</span>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Hedging & Tail-Risk Protection
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Pure Spitznagel ladder allocation, roll audit alerts, and The Marian Shield (v4.0) asymmetric Put stress test up to -50% market drop
          </p>
        </div>
      </div>

      {/* DASHBOARD CLIENT COMPONENT */}
      <HedgingDashboard initialData={hedgingData} />
    </div>
  )
}
