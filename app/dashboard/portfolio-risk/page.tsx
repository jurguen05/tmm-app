import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { getPortfolioRiskSourceData } from '../../../services/queries'
import { calcularPortfolioRisk } from '../../../lib/portfolioRiskCalculator'
import PortfolioRiskDashboard from '../../../components/PortfolioRiskDashboard'

export const instant = false

export default async function PortfolioRiskPage() {
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

  // Carga de datos de posiciones, transacciones vinculadas, cotizaciones MK-TOS y estrategias
  const { positions, transactions, mkTosQuotes, trades, strategies, spyCloses } =
    await getPortfolioRiskSourceData(supabase)

  // Cálculo puro server-side del riesgo de cartera y curva de absorción de stops
  const portfolioRiskData = calcularPortfolioRisk(
    positions,
    transactions,
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
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Portfolio Risk Analysis</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Capital exposure, stop-loss risk in dollars, and market drawdown absorption curve (0% to 50%)
          </p>
        </div>
      </div>

      {/* DASHBOARD CLIENT COMPONENT */}
      <PortfolioRiskDashboard initialData={portfolioRiskData} />
    </div>
  )
}
