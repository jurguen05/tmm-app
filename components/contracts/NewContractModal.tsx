'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { createContract, getNextContractNumber } from '../../services/queries';
import { Originator, Investor, InterestPayoutFrequency } from '../../types';

interface NewContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  originators: Originator[];
  investors?: Investor[];
  onOpenNewOriginator?: () => void;
  onOpenNewInvestor?: () => void;
}

export default function NewContractModal({
  isOpen,
  onClose,
  onSuccess,
  originators,
  investors = [],
  onOpenNewOriginator,
  onOpenNewInvestor
}: NewContractModalProps) {
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>('');
  const [investorName, setInvestorName] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialAmount, setInitialAmount] = useState<string>('15000');
  const [cutoffDay, setCutoffDay] = useState<number>(10);
  const [payoutFrequency, setPayoutFrequency] = useState<InterestPayoutFrequency>('MONTHLY');
  const [originatorId, setOriginatorId] = useState<string>('');
  const [investorUserId, setInvestorUserId] = useState<string>('');
  const [investorAnnualRatePct, setInvestorAnnualRatePct] = useState<string>('10.0'); // 10% TNA
  const [originatorAnnualRatePct, setOriginatorAnnualRatePct] = useState<string>('2.0'); // 2% TNA
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-asignación secuencial correlativa (Opción 1: CON-YYYY-001, CON-YYYY-002, etc.)
  useEffect(() => {
    if (isOpen) {
      const year = new Date(startDate).getFullYear() || new Date().getFullYear();
      getNextContractNumber(supabase, year).then(nextNum => {
        setContractNumber(nextNum);
      });
    }
  }, [isOpen, startDate]);

  // Si selecciona un inversor del directorio, precargar su nombre y user_id si lo tuviese
  const handleSelectInvestor = (id: string) => {
    setSelectedInvestorId(id);
    if (!id) {
      return;
    }
    const found = investors.find(i => i.id === id);
    if (found) {
      setInvestorName(found.name);
      if (found.user_id) {
        setInvestorUserId(found.user_id);
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const amountNum = parseFloat(initialAmount);
    const investorRateNum = parseFloat(investorAnnualRatePct) / 100;
    const originatorRateNum = parseFloat(originatorAnnualRatePct || '0') / 100;

    if (!investorName.trim()) {
      setErrorMessage('Investor name is required.');
      return;
    }
    if (!contractNumber.trim()) {
      setErrorMessage('Contract number is required.');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage('Initial amount must be greater than 0.');
      return;
    }
    if (isNaN(investorRateNum) || investorRateNum < 0) {
      setErrorMessage('Investor rate must be a positive percentage.');
      return;
    }
    if (cutoffDay < 1 || cutoffDay > 31) {
      setErrorMessage('Cutoff day must be between 1 and 31.');
      return;
    }

    setLoading(true);
    try {
      await createContract(
        supabase,
        {
          contract_number: contractNumber.trim(),
          investor_name: investorName.trim(),
          investor_id: selectedInvestorId || null,
          user_id: investorUserId.trim() || null,
          start_date: startDate,
          initial_amount: amountNum,
          cutoff_day: cutoffDay,
          payout_frequency: payoutFrequency,
          originator_id: originatorId || null,
          notes: notes.trim() || null
        },
        {
          investor_annual_rate: investorRateNum,
          originator_annual_rate: isNaN(originatorRateNum) ? 0 : originatorRateNum,
          notes: 'Initial rate agreed upon contract creation'
        }
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating contract:', err);
      setErrorMessage(err.message || 'Failed to create contract.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-gray-100 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <div>
            <h3 className="text-lg font-bold">New Investor Contract</h3>
            <p className="text-xs text-gray-400 mt-0.5">Register terms, starting capital, and client details</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Investor Selection / Name */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Investor / Client *
                </label>
                {onOpenNewInvestor && (
                  <button
                    type="button"
                    onClick={onOpenNewInvestor}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    + Add New Investor (Fiscal Profile)
                  </button>
                )}
              </div>

              {investors.length > 0 && (
                <div className="mb-2">
                  <select
                    value={selectedInvestorId}
                    onChange={e => handleSelectInvestor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-gray-50/50"
                  >
                    <option value="">-- Select from Saved Investors Directory --</option>
                    {investors.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} {inv.tax_id ? `• Tax ID: ${inv.tax_id}` : ''} {inv.email ? `(${inv.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input
                type="text"
                required
                placeholder="Or type investor / company name directly..."
                value={investorName}
                onChange={e => {
                  setInvestorName(e.target.value);
                  if (selectedInvestorId) setSelectedInvestorId('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>

            {/* Contract Number (Secuencial Correlativo) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Contract Number * (Auto-Sequential)
              </label>
              <input
                type="text"
                required
                value={contractNumber}
                onChange={e => setContractNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono font-bold text-gray-900"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>

            {/* Initial Amount */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Initial Capital (USD) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400 font-semibold text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="15000"
                  value={initialAmount}
                  onChange={e => setInitialAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono font-bold"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">6-month lockup schedule starts on this date</p>
            </div>

            {/* Cutoff Day */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Cutoff Day of Month *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={cutoffDay}
                onChange={e => setCutoffDay(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">Monthly compounding calculation day</p>
            </div>

            {/* Interest Payout Frequency */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Interest Payout Criteria *
              </label>
              <select
                value={payoutFrequency}
                onChange={e => setPayoutFrequency(e.target.value as InterestPayoutFrequency)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white"
              >
                <option value="MONTHLY">Monthly (Mensual)</option>
                <option value="BIMONTHLY">Bi-Monthly (Bimestral - 2m)</option>
                <option value="SEMIANNUAL">Semi-Annual (Semestral - 6m)</option>
                <option value="ANNUAL">Annual (Anual - 12m)</option>
                <option value="ON_DEMAND">On-Demand (A pedido)</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">Frequency criteria for interest distributions</p>
            </div>

            {/* Investor Annual Rate */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Investor Rate (Annual %) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="10.0"
                  value={investorAnnualRatePct}
                  onChange={e => setInvestorAnnualRatePct(e.target.value)}
                  className="w-full pr-8 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
                />
                <span className="absolute right-3 top-2 text-gray-400 font-semibold text-sm">%</span>
              </div>
            </div>

            {/* Originator Annual Rate */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Originator Rate (Annual %)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="2.0"
                  value={originatorAnnualRatePct}
                  onChange={e => setOriginatorAnnualRatePct(e.target.value)}
                  className="w-full pr-8 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
                />
                <span className="absolute right-3 top-2 text-gray-400 font-semibold text-sm">%</span>
              </div>
            </div>

            {/* Originator Selection */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Originator / Advisor
                </label>
                {onOpenNewOriginator && (
                  <button
                    type="button"
                    onClick={onOpenNewOriginator}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    + Add New Originator
                  </button>
                )}
              </div>
              <select
                value={originatorId}
                onChange={e => setOriginatorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white"
              >
                <option value="">-- No Originator Assigned --</option>
                {originators.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} {org.tax_id ? `• Tax ID: ${org.tax_id}` : ''} {org.email ? `(${org.email})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Investor User Account ID (Optional) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Assign to Investor Portal User ID (Optional)
              </label>
              <input
                type="text"
                placeholder="Supabase Auth UUID (optional, only if this investor logs in)"
                value={investorUserId}
                onChange={e => setInvestorUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Leave empty if managed purely internally. If specified, this user can log into TMM to view their contract.
              </p>
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Notes / Terms
              </label>
              <textarea
                rows={2}
                placeholder="Optional contract notes or special conditions..."
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
              {loading ? 'Creating...' : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
