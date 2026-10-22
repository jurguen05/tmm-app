'use client';

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { updateContract } from '../../services/queries';
import { Contract, ContractStatus, InterestPayoutFrequency } from '../../types';

interface EditContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: Contract;
}

export default function EditContractModal({
  isOpen,
  onClose,
  onSuccess,
  contract
}: EditContractModalProps) {
  const [cutoffDay, setCutoffDay] = useState<number>(contract.cutoff_day || 1);
  const [payoutFrequency, setPayoutFrequency] = useState<InterestPayoutFrequency>(
    contract.payout_frequency || 'ON_DEMAND'
  );
  const [status, setStatus] = useState<ContractStatus>(contract.status || 'Open');
  const [notes, setNotes] = useState<string>(contract.notes || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (cutoffDay < 1 || cutoffDay > 31) {
      setErrorMessage('Cutoff day must be between 1 and 31.');
      return;
    }

    setLoading(true);
    try {
      await updateContract(supabase, contract.id, {
        cutoff_day: Number(cutoffDay),
        payout_frequency: payoutFrequency,
        status: status,
        notes: notes.trim() || null
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating contract:', err);
      setErrorMessage(err.message || 'Failed to update contract.');
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
            <h3 className="text-lg font-bold">Edit Contract Settings</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Contract #{contract.contract_number} • {contract.investor_name}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Contract Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Contract Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('Open')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  status === 'Open'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                ● Active (Open)
              </button>
              <button
                type="button"
                onClick={() => setStatus('Closed')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  status === 'Closed'
                    ? 'bg-gray-200 border-gray-400 text-gray-900 ring-2 ring-gray-400/20'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                ○ Liquidated (Closed)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cutoff Day */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Monthly Cutoff Day (1 - 31) *
              </label>
              <input
                type="number"
                min={1}
                max={31}
                required
                value={cutoffDay}
                onChange={e => setCutoffDay(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Day of each month when interest compounds and ledgers cut off.
              </p>
            </div>

            {/* Payout Criteria */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Interest Payout Frequency *
              </label>
              <select
                value={payoutFrequency}
                onChange={e => setPayoutFrequency(e.target.value as InterestPayoutFrequency)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="BIMONTHLY">Bi-Monthly (Every 2 mo)</option>
                <option value="SEMIANNUAL">Semi-Annual (Every 6 mo)</option>
                <option value="ANNUAL">Annual (Every 12 mo)</option>
                <option value="ON_DEMAND">On-Demand / Capitalized</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Defines the expected distribution schedule and notification timeline.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Contract Notes & Agreements
            </label>
            <textarea
              rows={3}
              placeholder="Add contractual remarks, bank details or specific terms..."
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
