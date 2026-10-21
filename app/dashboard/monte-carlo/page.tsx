import { connection } from 'next/server';
import { createClientSSR } from '@/lib/supabaseServer';
import { getClosedTradesForMonteCarlo } from '@/services/queries';
import { extractTradeReturns, runMonteCarloSimulation } from '@/lib/monteCarloCalculator';
import MonteCarloDashboard from '@/components/MonteCarloDashboard';

export const instant = false;

export default async function MonteCarloPage() {
  await connection();
  const supabase = await createClientSSR();

  // 1. Fetch closed trades with valid investment and realized P&L
  const closedTrades = await getClosedTradesForMonteCarlo(supabase).catch((err) => {
    console.warn('[MonteCarloPage] Error fetching closed trades:', err);
    return [];
  });

  // 2. Extract empirical trade returns (r_i = realized_pnl / initial_investment)
  const tradeReturns = extractTradeReturns(closedTrades);

  // 3. Compute pure server-side initial Monte Carlo simulation
  const initialResult = runMonteCarloSimulation(tradeReturns);

  return (
    <MonteCarloDashboard
      initialResult={initialResult}
      initialReturns={tradeReturns}
    />
  );
}
