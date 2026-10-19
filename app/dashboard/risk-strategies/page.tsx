import { connection } from 'next/server'
import { createClientSSR } from '@/lib/supabaseServer'
import { getAllClosedTrades } from '@/services/queries'
import { calculatePnLHistogram } from '@/lib/histogramCalculator'
import RiskHistogramDashboard from '@/components/RiskHistogramDashboard'

export const instant = false

export default async function RiskStrategiesPage() {
  await connection()
  const supabase = await createClientSSR()

  // 1. Cargar trades cerrados para el análisis de distribución de riesgo
  const closedTrades = await getAllClosedTrades(supabase).catch(() => [])

  // 2. Cálculo puro en dominio para SSR del histograma de P&L y curva CRF (30 bins estándar)
  const histogramResult = calculatePnLHistogram(closedTrades, 30)

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <RiskHistogramDashboard
        initialTrades={closedTrades}
        initialResult={histogramResult}
      />
    </div>
  )
}
