'use client';

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { addContractRateChange } from '../../services/queries';
import { Contract } from '../../types';

interface RateChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: Contract;
}

export default function RateChangeModal({
  isOpen,
  onClose,
  onSuccess,
  contract
}: RateChangeModalProps) {
  const currentInvestorRate = contract.rates && contract.rates.length > 0
    ? (contract.rates[contract.rates.length - 1].investor_annual_rate * 100).toFixed(2)
    : '10.00';
  const currentOriginatorRate = contract.rates && contract.rates.length > 0
    ? (contract.rates[contract.rates.length - 1].originator_annual_rate * 100).toFixed(2)
    : '2.00';

  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [investorRatePct, setInvestorRatePct] = useState<string>(currentInvestorRate);
  const [originatorRatePct, setOriginatorRatePct] = useState<string>(currentOriginatorRate);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const invNum = parseFloat(investorRatePct) / 100;
    const orgNum = parseFloat(originatorRatePct || '0') / 100;

    if (isNaN(invNum) || invNum < 0) {
      setErrorMessage('Investor rate must be a valid positive percentage.');
      return;
    }

    setLoading(true);
    try {
      await addContractRateChange(supabase, {
        contract_id: contract.id,
        effective_date: effectiveDate,
        investor_annual_rate: invNum,
        originator_annual_rate: isNaN(orgNum) ? 0 : orgNum,
        notes: notes.trim() || null
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error changing rate:', err);
      setErrorMessage(err.message || 'Failed to update interest rate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <div>
            <h3 className="text-lg font-bold">Update Interest Rates</h3>
            <p className="text-xs text-gray-400 mt-0.5">Contract #{contract.contract_number} • Set effective terms</p>
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

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Effective Date *
            </label>
            <input
              type="date"
              required
              value={effectiveDate}
              onChange={e => setEffectiveDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Calculations starting from this date forward will apply these rates.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              New Investor Rate (Annual %) *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                required
                placeholder="10.0"
                value={investorRatePct}
                onChange={e => setInvestorRatePct(e.target.value)}
                className="w-full pr-8 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
              />
              <span className="absolute right-3 top-2 text-gray-400 font-semibold text-sm">%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              New Originator Commission Rate (Annual %)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="2.0"
                value={originatorRatePct}
                onChange={e => setOriginatorRatePct(e.target.value)}
                className="w-full pr-8 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
              />
              <span className="absolute right-3 top-2 text-gray-400 font-semibold text-sm">%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Reason / Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Annual renegotiation / Market adjustment"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
            />
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
              {loading ? 'Saving...' : 'Apply Rate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
