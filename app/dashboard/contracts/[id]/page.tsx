import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { createClientSSR } from '../../../../lib/supabaseServer';
import { getContractById, getUserProfile } from '../../../../services/queries';
import { calculateMonthlyLedger, calculateContractSummary } from '../../../../lib/contractCalculator';
import ContractDetailView from '../../../../components/contracts/ContractDetailView';

export const instant = false;

interface ContractDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ContractDetailPage({ params }: ContractDetailPageProps) {
  await connection();
  const { id } = await params;
  const supabase = await createClientSSR();

  const { data: { user } } = await supabase.auth.getUser();
  const perfil = user ? await getUserProfile(supabase, user.id) : null;
  const isInvestor = perfil?.role_id === 2;

  // Si es inversor, restringimos por user.id
  const contract = await getContractById(supabase, id, isInvestor && user ? user.id : undefined);

  if (!contract) {
    notFound();
  }

  // Cálculos puros del dominio financiero
  const ledger = calculateMonthlyLedger(contract);
  const summary = calculateContractSummary(contract, ledger);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <ContractDetailView
        contract={contract}
        ledger={ledger}
        summary={summary}
        isInvestor={isInvestor}
      />
    </div>
  );
}
