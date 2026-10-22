import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { createClientSSR } from '../../../../lib/supabaseServer';
import { getContracts, getOriginators, getUserProfile } from '../../../../services/queries';
import OriginatorsView from '../../../../components/contracts/OriginatorsView';

export const instant = false;

export default async function OriginatorsPage() {
  await connection();
  const supabase = await createClientSSR();

  const { data: { user } } = await supabase.auth.getUser();
  const perfil = user ? await getUserProfile(supabase, user.id) : null;

  // Inversores no tienen acceso al panel de originadores
  if (perfil?.role_id === 2) {
    redirect('/dashboard/contracts');
  }

  const [contracts, originators] = await Promise.all([
    getContracts(supabase),
    getOriginators(supabase)
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <OriginatorsView
        originators={originators}
        contracts={contracts}
      />
    </div>
  );
}
