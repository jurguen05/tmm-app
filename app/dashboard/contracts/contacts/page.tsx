import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { createClientSSR } from '../../../../lib/supabaseServer';
import { getContracts, getContacts, getUserProfile } from '../../../../services/queries';
import ContactsView from '../../../../components/contracts/ContactsView';

export const instant = false;

export default async function ContactsPage() {
  await connection();
  const supabase = await createClientSSR();

  const { data: { user } } = await supabase.auth.getUser();
  const perfil = user ? await getUserProfile(supabase, user.id) : null;

  // Clientes sin rol operador no acceden al directorio general
  if (perfil?.role_id === 2) {
    redirect('/dashboard/contracts');
  }

  const [contracts, contacts] = await Promise.all([
    getContracts(supabase),
    getContacts(supabase)
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <ContactsView
        contacts={contacts}
        contracts={contracts}
      />
    </div>
  );
}
