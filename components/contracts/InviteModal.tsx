'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { createInvitation } from '../../services/queries';
import { Contact, Invitation } from '../../types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: Contact | null;
}

export default function InviteModal({ isOpen, onClose, contact }: InviteModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<number>(2); // 2: Investor Portal, 1: Operator
  const [isInvestor, setIsInvestor] = useState(true);
  const [isOriginator, setIsOriginator] = useState(false);
  const [generatedInvitation, setGeneratedInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setEmail(contact.email || '');
      setIsInvestor(contact.is_investor);
      setIsOriginator(contact.is_originator);
      setRoleId(contact.role_id === 1 ? 1 : 2);
    } else {
      setName('');
      setEmail('');
      setIsInvestor(true);
      setIsOriginator(false);
      setRoleId(2);
    }
    setGeneratedInvitation(null);
    setCopied(false);
    setErrorMessage(null);
  }, [contact, isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const inv = await createInvitation(supabase, {
        name: name.trim() || null,
        email: email.trim() || null,
        contact_id: contact?.id || null,
        role_id: roleId,
        is_investor: isInvestor,
        is_originator: isOriginator
      });

      setGeneratedInvitation(inv);
    } catch (err: any) {
      console.error('Error generating invitation:', err);
      setErrorMessage(err.message || 'Failed to generate invitation link.');
    } finally {
      setLoading(false);
    }
  };

  const inviteUrl = generatedInvitation
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${generatedInvitation.token}`
    : '';

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <div>
            <h3 className="text-lg font-bold">
              {contact ? `Invite ${contact.name}` : 'New Invitation Link'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Send a private onboarding link for user data completion and password setup
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {errorMessage}
            </div>
          )}

          {!generatedInvitation ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Recipient info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Recipient Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Robert Johnson"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. robert@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Technical System Role */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Assigned Platform Access
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRoleId(2)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      roleId === 2
                        ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-xs font-bold text-indigo-900">Investor Portal (role_id = 2)</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Client view restricted solely to their own contracts and ledgers.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoleId(1)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      roleId === 1
                        ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-xs font-bold text-emerald-900">Operator / Admin (role_id = 1)</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Full access to trading, contracts, hedging, and administration.
                    </div>
                  </button>
                </div>
              </div>

              {/* Commercial Roles */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Pre-assigned Commercial Roles
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isInvestor ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}>
                    <input
                      type="checkbox"
                      checked={isInvestor}
                      onChange={e => setIsInvestor(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold">Investor</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isOriginator ? 'bg-purple-50 border-purple-300 text-purple-900' : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}>
                    <input
                      type="checkbox"
                      checked={isOriginator}
                      onChange={e => setIsOriginator(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold">Originator</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? 'Generating...' : 'Generate Invitation Link'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <span className="text-base">✅</span>
                  <span>Invitation Link Ready!</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Send this unique link to the recipient via WhatsApp, Email, or Slack. 
                  When they open it, they will complete their personal/tax details and choose their password.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Private Onboarding Link (Valid for 7 days)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-800 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-sm ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    <span>{copied ? '✓ Copied!' : '📋 Copy Link'}</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1">
                <div><strong>Assigned Role:</strong> {generatedInvitation.role_id === 1 ? 'Operator / Admin' : 'Investor Portal'}</div>
                <div><strong>Commercial Roles:</strong> {[generatedInvitation.is_investor && 'Investor', generatedInvitation.is_originator && 'Originator'].filter(Boolean).join(' + ') || 'None'}</div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
