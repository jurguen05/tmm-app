'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { createContact, updateContact } from '../../services/queries';
import { Contact } from '../../types';

interface NewContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (saved: Contact) => void;
  defaultRole?: 'investor' | 'originator';
  contactToEdit?: Contact | null;
}

export default function NewContactModal({
  isOpen,
  onClose,
  onSuccess,
  defaultRole,
  contactToEdit
}: NewContactModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [payoutInfo, setPayoutInfo] = useState('');
  const [isInvestor, setIsInvestor] = useState(defaultRole === 'investor' || !defaultRole);
  const [isOriginator, setIsOriginator] = useState(defaultRole === 'originator');
  const [systemRole, setSystemRole] = useState<'NONE' | 'INVESTOR' | 'OPERATOR'>('NONE');
  const [userId, setUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (contactToEdit) {
      setName(contactToEdit.name || '');
      setEmail(contactToEdit.email || '');
      setPhone(contactToEdit.phone || '');
      setCountry(contactToEdit.country || '');
      setTaxId(contactToEdit.tax_id || '');
      setAddress(contactToEdit.address || '');
      setPayoutInfo(contactToEdit.payout_info || '');
      setIsInvestor(contactToEdit.is_investor);
      setIsOriginator(contactToEdit.is_originator);
      setUserId(contactToEdit.user_id || '');
      setNotes(contactToEdit.notes || '');

      if (contactToEdit.role_id === 1) {
        setSystemRole('OPERATOR');
      } else if (contactToEdit.role_id === 2) {
        setSystemRole('INVESTOR');
      } else {
        setSystemRole('NONE');
      }
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setCountry('');
      setTaxId('');
      setAddress('');
      setPayoutInfo('');
      setIsInvestor(defaultRole === 'investor' || !defaultRole);
      setIsOriginator(defaultRole === 'originator');
      setSystemRole(defaultRole === 'investor' ? 'INVESTOR' : 'NONE');
      setUserId('');
      setNotes('');
    }
  }, [contactToEdit, isOpen, defaultRole]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    setLoading(true);
    try {
      const roleIdNumber = systemRole === 'OPERATOR' ? 1 : (systemRole === 'INVESTOR' ? 2 : null);

      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        country: country.trim() || null,
        tax_id: taxId.trim() || null,
        address: address.trim() || null,
        payout_info: payoutInfo.trim() || null,
        is_investor: isInvestor,
        is_originator: isOriginator,
        user_id: userId.trim() || null,
        role_id: roleIdNumber,
        notes: notes.trim() || null
      };

      let saved: Contact;
      if (contactToEdit) {
        saved = await updateContact(supabase, contactToEdit.id, payload);
      } else {
        saved = await createContact(supabase, payload);
      }

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error('Error saving contact:', err);
      setErrorMessage(err.message || 'Failed to save contact.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <div>
            <h3 className="text-lg font-bold">
              {contactToEdit ? 'Edit Entity / Contact' : 'New Entity / Contact'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Unified profile for investor or advisor/originator</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Role Checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Roles & Caps (Can have multiple) *
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Full Name / Legal Entity *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Robert Johnson / RJ Ventures"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. robert@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Phone / WhatsApp
              </label>
              <input
                type="tel"
                placeholder="e.g. +1 (555) 019-2834"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Country
              </label>
              <input
                type="text"
                placeholder="e.g. Argentina, USA, Uruguay, Spain"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>

            {/* Tax ID */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Tax ID / DNI / CUIT
              </label>
              <input
                type="text"
                placeholder="e.g. 20-34567890-9"
                value={taxId}
                onChange={e => setTaxId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Tax Address / City
              </label>
              <input
                type="text"
                placeholder="e.g. Buenos Aires / Miami, FL"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>

            {/* Payout Details */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Single Payout Destination (CBU / Alias / USDT TRC20)
              </label>
              <input
                type="text"
                placeholder="e.g. Alias: robert.inversiones / USDT TRC20: T..."
                value={payoutInfo}
                onChange={e => setPayoutInfo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Used for all distributions (both interest payouts and originator commissions).
              </p>
            </div>

            {/* Technical System Access (Clean Architecture Party-Role) */}
            <div className="sm:col-span-2 pt-2 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Platform Access & Technical Role
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setSystemRole('NONE')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                    systemRole === 'NONE'
                      ? 'bg-gray-200 border-gray-400 text-gray-900 shadow-xs ring-1 ring-gray-400'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  No Web Access
                </button>
                <button
                  type="button"
                  onClick={() => setSystemRole('INVESTOR')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                    systemRole === 'INVESTOR'
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-xs ring-1 ring-indigo-400'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Investor Portal
                </button>
                <button
                  type="button"
                  onClick={() => setSystemRole('OPERATOR')}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                    systemRole === 'OPERATOR'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs ring-1 ring-emerald-400'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Operator / Admin
                </button>
              </div>

              {systemRole !== 'NONE' && (
                <div className="mt-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Supabase Auth User ID (UUID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Matches the user account in Supabase Authentication. When set, assigns system role: {systemRole === 'OPERATOR' ? 'role_id = 1 (Full Access)' : 'role_id = 2 (Contract Portal)'}.
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional relationship notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
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
              {loading ? 'Saving...' : (contactToEdit ? 'Save Changes' : 'Save Contact')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
