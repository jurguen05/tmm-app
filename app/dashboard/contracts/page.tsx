import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { createClientSSR } from '../../../lib/supabaseServer';
import { getContracts, getOriginators, getInvestors, getContacts, getUserProfile } from '../../../services/queries';
import ContractsDashboard from '../../../components/contracts/ContractsDashboard';

export const instant = false;

export default async function ContractsPage() {
  await connection();
  const supabase = await createClientSSR();

  const { data: { user } } = await supabase.auth.getUser();
  const perfil = user ? await getUserProfile(supabase, user.id) : null;
  const isInvestor = perfil?.role_id === 2;

  // Si es inversor, solo traemos sus contratos asignados
  const contracts = await getContracts(supabase, isInvestor && user ? user.id : undefined);

  // Si es un inversor y tiene exactamente 1 contrato, redirigir directo al detalle de su contrato
  if (isInvestor && contracts.length === 1) {
    redirect(`/dashboard/contracts/${contracts[0].id}`);
  }

  // Los operadores cargan la lista completa de contactos
  const [originators, investors, contacts] = isInvestor
    ? [[], [], []]
    : await Promise.all([
        getOriginators(supabase),
        getInvestors(supabase),
        getContacts(supabase)
      ]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <ContractsDashboard
        initialContracts={contracts}
        initialOriginators={originators}
        initialInvestors={investors}
        initialContacts={contacts}
        isInvestor={isInvestor}
      />
    </div>
  );
}
