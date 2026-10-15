import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { getDashboardExecutiveSourceData } from '../../services/queries'
import { calcularExecutiveDashboard } from '../../lib/dashboardStatsCalculator'
import DashboardExecutiveTables from '../../components/DashboardExecutiveTables'

export const instant = false

export default async function DashboardPage() {
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