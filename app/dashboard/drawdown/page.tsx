import { connection } from 'next/server'
import { createClientSSR } from '@/lib/supabaseServer'
import { getAllClosedTrades, getAllTransactions } from '@/services/queries'
import { calculateEquityCurve } from '@/lib/equityCurveCalculator'
import DrawdownEquityDashboard from '@/components/DrawdownEquityDashboard'

export const instant = false

export default async function DrawdownPage() {
  await connection()
  const supabase = await createClientSSR()

  // 1. Obtener datos de trades cerrados y transacciones para fallback de P&L
  const [closedTrades, transactions] = await Promise.all([
    getAllClosedTrades(supabase).catch(() => []),
    getAllTransactions(supabase).catch(() => [])
  ])

  // 2. Cálculo puro en dominio para SSR de la curva de equidad y picos HWM
  const equitySummary = calculateEquityCurve(closedTrades, transactions)

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <DrawdownEquityDashboard initialSummary={equitySummary} />
    </div>
  )
}
