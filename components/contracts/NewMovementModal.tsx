'use client';

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { addContractMovement, updateContract } from '../../services/queries';
import { Contract, ContractFinancialSummary, ContractMovementType } from '../../types';
import { formatMoney } from '../../lib/formatters';

interface NewMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: Contract;
  summary: ContractFinancialSummary;
}

export default function NewMovementModal({
  isOpen,
  onClose,
  onSuccess,
  contract,
  summary
}: NewMovementModalProps) {
  const [movementType, setMovementType] = useState<ContractMovementType>('CAPITAL_DEPOSIT');
  const [amount, setAmount] = useState<string>('');
  const [movementDate, setMovementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [closeOnZeroBalance, setCloseOnZeroBalance] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const isCapitalWithdrawal = movementType === 'CAPITAL_WITHDRAWAL';
  const isInterestWithdrawal = movementType === 'INTEREST_WITHDRAWAL';

  // Aviso informativo de 6 meses (sin bloqueo)
  const exceedsWithdrawable = isCapitalWithdrawal && numAmount > summary.withdrawable_capital;
  const earlyAmount = exceedsWithdrawable ? numAmount - summary.withdrawable_capital : 0;

  // Verificación de retiro total de capital
  const willCloseContract = isCapitalWithdrawal && numAmount >= summary.total_capital;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (numAmount <= 0) {
      setErrorMessage('Amount must be greater than $0.');
      return;
    }

    if (isCapitalWithdrawal && numAmount > summary.total_capital) {
      setErrorMessage(`Withdrawal cannot exceed total active capital ($${formatMoney(summary.total_capital)}).`);
      return;
    }

    if (isInterestWithdrawal && numAmount > summary.available_interest) {
      setErrorMessage(`Cannot withdraw more than available interest ($${formatMoney(summary.available_interest)}).`);
      return;
    }

    setLoading(true);
    try {
      await addContractMovement(supabase, {
        contract_id: contract.id,
        movement_type: movementType,
        amount: numAmount,
        movement_date: movementDate,
        notes: notes.trim() || null
      });

      // Si el retiro liquida el saldo total de capital, actualiza explícitamente el contrato
      if (willCloseContract && closeOnZeroBalance) {
        await updateContract(supabase, contract.id, { status: 'Closed' });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error adding movement:', err);
      setErrorMessage(err.message || 'Failed to record movement.');
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
            <h3 className="text-lg font-bold">Record Movement</h3>
            <p className="text-xs text-gray-400 mt-0.5">Contract #{contract.contract_number} • {contract.investor_name}</p>
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

        {/* Current Balances Context Banner */}
        <div className="bg-gray-50 border-b border-gray-200/80 px-6 py-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-gray-500">Total Capital</div>
            <div className="font-bold text-gray-900 font-mono text-sm">${formatMoney(summary.total_capital)}</div>
          </div>
          <div>
            <div className="text-emerald-700 font-medium">Eligible (&gt;6m)</div>
            <div className="font-bold text-emerald-800 font-mono text-sm">${formatMoney(summary.withdrawable_capital)}</div>
          </div>
          <div>
            <div className="text-indigo-700 font-medium">Available Interest</div>
            <div className="font-bold text-indigo-800 font-mono text-sm">${formatMoney(summary.available_interest)}</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Movement Type Tabs */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Operation Type *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMovementType('CAPITAL_DEPOSIT')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                  movementType === 'CAPITAL_DEPOSIT'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                + Capital Deposit
              </button>
              <button
                type="button"
                onClick={() => setMovementType('CAPITAL_WITHDRAWAL')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                  movementType === 'CAPITAL_WITHDRAWAL'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                - Capital Withdrawal
              </button>
              <button
                type="button"
                onClick={() => setMovementType('INTEREST_WITHDRAWAL')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                  movementType === 'INTEREST_WITHDRAWAL'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-800 shadow-xs'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                - Interest Payout
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Amount (USD) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400 font-semibold text-sm">$</span>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono text-base font-bold text-gray-900"
              />
            </div>
            {movementType === 'CAPITAL_DEPOSIT' && (
              <p className="text-[11px] text-gray-500 mt-1">
                Standard advisory guideline: Recommended 6-month capital lockup period.
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Date *
            </label>
            <input
              type="date"
              required
              value={movementDate}
              onChange={e => setMovementDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-mono"
            />
          </div>

          {/* 6-Month Lockup Advisory Notice (Informative only, no blocking) */}
          {exceedsWithdrawable && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1 text-amber-900">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <span className="text-amber-600">ℹ️</span>
                <span>Lockup Advisory Notice</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                This withdrawal includes <strong>${formatMoney(earlyAmount)}</strong> deposited less than 6 months ago. 
                Lockups are purely advisory in this system and do not restrict or block this operation.
              </p>
            </div>
          )}

          {/* Total Liquidation / Close Contract Option */}
          {willCloseContract && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-2 text-indigo-950">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                <span>📋</span>
                <span>Full Capital Liquidation</span>
              </div>
              <p className="text-indigo-800">
                This withdrawal reduces the active capital balance to <strong>$0.00</strong>.
              </p>
              <label className="flex items-center gap-2 pt-1.5 border-t border-indigo-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={closeOnZeroBalance}
                  onChange={e => setCloseOnZeroBalance(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-semibold text-indigo-900">
                  Update contract status to &quot;Closed&quot; upon recording
                </span>
              </label>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Notes / Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Additional capital injection / Wire ref #123"
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
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                'Save Movement'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
