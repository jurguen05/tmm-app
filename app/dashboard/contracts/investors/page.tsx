import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { createClientSSR } from '../../../../lib/supabaseServer';
import { getContracts, getInvestors, getUserProfile } from '../../../../services/queries';
import InvestorsView from '../../../../components/contracts/InvestorsView';

export const instant = false;

export default async function InvestorsPage() {
  await connection();
  const supabase = await createClientSSR();

  const { data: { user } } = await supabase.auth.getUser();
  const perfil = user ? await getUserProfile(supabase, user.id) : null;

  // Inversores no tienen acceso a ver a los otros inversores
  if (perfil?.role_id === 2) {
    redirect('/dashboard/contracts');
  }

  const [contracts, investors] = await Promise.all([
    getContracts(supabase),
    getInvestors(supabase)
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <InvestorsView
        investors={investors}
        contracts={contracts}
      />
    </div>
  );
}
