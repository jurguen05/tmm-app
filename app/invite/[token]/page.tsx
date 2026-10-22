import { connection } from 'next/server';
import Link from 'next/link';
import { createClientSSR } from '../../../lib/supabaseServer';
import { getInvitationByToken } from '../../../services/queries';
import OnboardingForm from '../../../components/contracts/OnboardingForm';

export const instant = false;

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  await connection();
  const { token } = await params;
  const supabase = await createClientSSR();

  const invitation = await getInvitationByToken(supabase, token);

  if (!invitation || invitation.status !== 'Pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 text-3xl mb-4">
            ⚠️
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Invalid or Expired Invitation
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            This invitation link is either invalid, has already been used, or has expired.
            Please request a new private invitation link from your portfolio administrator.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              ← Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <OnboardingForm invitation={invitation} />;
}
