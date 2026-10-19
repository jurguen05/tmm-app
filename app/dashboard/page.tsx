import { connection } from 'next/server'
import { getDashboardExecutiveSourceData } from '../../services/queries'
import { calcularExecutiveDashboard } from '../../lib/dashboardStatsCalculator'
import DashboardExecutiveTables from '../../components/DashboardExecutiveTables'
import { createClientSSR } from '../../lib/supabaseServer'

export const instant = false

export default async function DashboardPage() {
  await connection()
  const supabase = await createClientSSR()

  // Carga de datos analíticos del Centro de Control Ejecutivo (incluyendo Cash & Sweep Vehicle)
  const { positions, transactions, strategies, trades, cashBalance } = await getDashboardExecutiveSourceData(supabase)

  // Cálculo puro server-side para SSR instantáneo de las 4 tablas ejecutivas
  const executiveDashboardData = calcularExecutiveDashboard(
    positions,
    transactions,
    strategies,
    trades,
    cashBalance
  )


  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* CENTRO DE CONTROL EJECUTIVO (4 TABLAS ANALÍTICAS) */}
      <DashboardExecutiveTables
        initialData={executiveDashboardData}
        positions={positions}
        strategies={strategies}
        trades={trades}
        transactions={transactions}
      />
    </div>
  )
}