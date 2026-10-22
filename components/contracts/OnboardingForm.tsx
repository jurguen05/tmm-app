'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { createContact, updateContact } from '../../services/queries';
import { Invitation } from '../../types';

interface OnboardingFormProps {
  invitation: Invitation;
}

export default function OnboardingForm({ invitation }: OnboardingFormProps) {
  const router = useRouter();
  const contact = (invitation as any).contact;

  const [name, setName] = useState(invitation.name || contact?.name || '');
  const [email, setEmail] = useState(invitation.email || contact?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState(contact?.country || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [taxId, setTaxId] = useState(contact?.tax_id || '');
  const [payoutInfo, setPayoutInfo] = useState(contact?.payout_info || '');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Email address is required.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create account in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim()
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const userId = authData.user?.id;

      if (!userId) {
        // If email confirmation is required by Supabase project settings
        setErrorMessage('Account created! Please check your email to confirm your account, then sign in.');
        return;
      }

      // 2. Set role in profiles table
      await supabase.from('profiles').upsert({
        id: userId,
        role_id: invitation.role_id
      });

      // 3. Link or create contact profile
      const contactPayload = {
        name: name.trim(),
        email: email.trim(),
        country: country.trim() || null,
        phone: phone.trim() || null,
        tax_id: taxId.trim() || null,
        payout_info: payoutInfo.trim() || null,
        is_investor: invitation.is_investor,
        is_originator: invitation.is_originator,
        user_id: userId,
        role_id: invitation.role_id
      };

      if (invitation.contact_id) {
        await updateContact(supabase, invitation.contact_id, contactPayload);
      } else {
        await createContact(supabase, contactPayload);
      }

      // 4. Mark invitation as Accepted
      await supabase
        .from('invitations')
        .update({
          status: 'Accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      // 5. Sign in session and redirect
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Onboarding registration error:', err);
      setErrorMessage(err.message || 'An error occurred while creating your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="text-center mb-6">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white text-2xl font-bold shadow-lg shadow-indigo-600/30 mb-3">
            T
          </span>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Complete Your Registration
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome to TMM Portfolio & Investment Management. Fill in your details below to activate your account.
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100 sm:px-10">
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Full Name / Legal Entity *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Robert Johnson"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            {/* Email */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Email Address *
                </label>
                {(invitation.email || contact?.email) && (
                  <span className="text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-md">
                    Autocompleted from invitation (editable)
                  </span>
                )}
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="robert@example.com"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                This email will be your account login. You can modify it if you prefer to use another email.
              </p>
            </div>

            {/* Password and Confirm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Create Password *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>

            {/* Country and Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="e.g. Argentina, USA, Spain"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Phone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>

            {/* Tax ID */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Tax ID / DNI / CUIT / Passport (Optional)
              </label>
              <input
                type="text"
                value={taxId}
                onChange={e => setTaxId(e.target.value)}
                placeholder="e.g. 20-34567890-9"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
              />
            </div>

            {/* Payout Details */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Payout Account / Wallet (Optional)
              </label>
              <input
                type="text"
                value={payoutInfo}
                onChange={e => setPayoutInfo(e.target.value)}
                placeholder="e.g. Alias: robert.inversiones / USDT TRC20: T..."
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Used to receive distributions and returns. Can be updated anytime later.
              </p>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 border border-transparent rounded-xl shadow-md shadow-indigo-600/25 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Activating Account...' : 'Complete Registration & Sign In →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
