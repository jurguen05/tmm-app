'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contract, ContractFinancialSummary, ContractMonthlyLedgerRow } from '../../types';
import { formatMoney, formatPct } from '../../lib/formatters';
import MonthlyLedgerTable from './MonthlyLedgerTable';
import NewMovementModal from './NewMovementModal';
import RateChangeModal from './RateChangeModal';
import EditContractModal from './EditContractModal';

interface ContractDetailViewProps {
  contract: Contract;
  ledger: ContractMonthlyLedgerRow[];
  summary: ContractFinancialSummary;
  isInvestor?: boolean;
}

export default function ContractDetailView({
  contract,
  ledger,
  summary,
  isInvestor = false
}: ContractDetailViewProps) {
  const router = useRouter();
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ledger' | 'movements' | 'rates'>('ledger');

  const activeRate = contract.rates && contract.rates.length > 0
    ? contract.rates[contract.rates.length - 1]
    : null;

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* Navigation breadcrumb & title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/dashboard/contracts" className="hover:text-indigo-600 transition-colors">
              Contracts
            </Link>
            <span>/</span>
            <span className="font-mono text-gray-700">{contract.contract_number}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {contract.investor_name}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              contract.status === 'Open'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}>
              {contract.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Started on <span className="font-mono">{contract.start_date}</span> • Cutoff day <span className="font-mono font-bold">#{contract.cutoff_day}</span>
            {' '}• Payout: <span className="font-semibold text-indigo-700 capitalize">{(contract.payout_frequency || 'ON_DEMAND').toLowerCase().replace('_', ' ')}</span>
            {summary.next_payout_date && (
              <> • Next Payout: <span className="font-mono font-bold text-gray-800">{summary.next_payout_date}</span></>
            )}
            {contract.originator && (
              <> • Originator: <span className="font-semibold text-gray-800">{contract.originator.name}</span></>
            )}
          </p>
        </div>

        {/* Action Buttons */}
        {!isInvestor && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              ⚙ Edit Contract
            </button>
            <button
              onClick={() => setIsRateModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Update Rates
            </button>
            <button
              onClick={() => setIsMovementModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>Record Movement</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Capital */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Capital (t)</span>
          <div className="text-2xl font-bold text-gray-900 font-mono mt-2">
            ${formatMoney(summary.total_capital)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Current compounded balance
          </div>
        </div>

        {/* Withdrawable Capital */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Eligible Capital</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">&gt;6 Months</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono mt-2">
            ${formatMoney(summary.withdrawable_capital)}
          </div>
          <div className="text-xs text-emerald-800 mt-1">
            Free to withdraw immediately
          </div>
        </div>

        {/* Locked Capital */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Locked Capital</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">&lt;6 Months</span>
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono mt-2">
            ${formatMoney(summary.locked_capital)}
          </div>
          <div className="text-xs text-amber-800 mt-1">
            {summary.locked_deposits.length} deposit(s) in lockup period
          </div>
        </div>

        {/* Available Interest */}
        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs bg-indigo-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Available Interests</span>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-semibold">Unrestricted</span>
          </div>
          <div className="text-2xl font-bold text-indigo-700 font-mono mt-2">
            ${formatMoney(summary.available_interest)}
          </div>
          <div className="text-xs text-indigo-800 mt-1">
            Total earned: +${formatMoney(summary.accumulated_interest)}
          </div>
        </div>
      </div>

      {/* Lockup Banner if there are locked deposits */}
      {summary.locked_deposits.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs">
          <div className="font-bold text-amber-900 mb-2 flex items-center gap-1.5">
            <span>🔒</span>
            <span>6-Month Minimum Holding Schedule</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {summary.locked_deposits.map((item, idx) => (
              <div key={idx} className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80 flex items-center justify-between">
                <div>
                  <div className="font-mono font-bold text-gray-900">${formatMoney(item.amount)}</div>
                  <div className="text-[11px] text-gray-500">Deposited: {item.deposit_date}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold text-amber-800">Unlocks on {item.lockup_until}</div>
                  <div className="text-[10px] font-mono text-gray-500">{item.days_remaining} days left</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === 'ledger'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Monthly Schedule (Excel Model)
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === 'movements'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Movements History ({contract.movements?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('rates')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === 'rates'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Rates History ({contract.rates?.length || 0})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'ledger' && (
        <MonthlyLedgerTable 
          rows={ledger} 
          hasOriginator={!isInvestor && Boolean(contract.originator_id && activeRate && activeRate.originator_annual_rate > 0)} 
        />
      )}

      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[11px] tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3">Lockup Release</th>
                <th className="px-6 py-3">Agreement Flag</th>
                <th className="px-6 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(!contract.movements || contract.movements.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No movements recorded yet.
                  </td>
                </tr>
              ) : (
                contract.movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50/70 font-mono">
                    <td className="px-6 py-3 text-gray-700 font-sans">{mov.movement_date}</td>
                    <td className="px-6 py-3 font-sans">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        mov.movement_type === 'CAPITAL_DEPOSIT'
                          ? 'bg-emerald-50 text-emerald-800'
                          : mov.movement_type === 'CAPITAL_WITHDRAWAL'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-indigo-50 text-indigo-800'
                      }`}>
                        {mov.movement_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-gray-900">
                      ${formatMoney(mov.amount)}
                    </td>
                    <td className="px-6 py-3 text-gray-500 font-sans">
                      {mov.lockup_until || '-'}
                    </td>
                    <td className="px-6 py-3 font-sans">
                      {mov.agreed_withdrawal ? (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold text-[11px]">
                          Early Agreed
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-600 font-sans">{mov.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'rates' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[11px] tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-3">Effective Date</th>
                <th className="px-6 py-3 text-right">Investor Rate (TNA)</th>
                <th className="px-6 py-3 text-right">Originator Rate (TNA)</th>
                <th className="px-6 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {(!contract.rates || contract.rates.length === 0) ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400 font-sans">
                    No rate history recorded.
                  </td>
                </tr>
              ) : (
                contract.rates.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70">
                    <td className="px-6 py-3 text-gray-700 font-sans font-medium">{r.effective_date}</td>
                    <td className="px-6 py-3 text-right font-bold text-indigo-700">
                      {formatPct(r.investor_annual_rate * 100)}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-purple-700">
                      {formatPct((r.originator_annual_rate || 0) * 100)}
                    </td>
                    <td className="px-6 py-3 text-gray-600 font-sans">{r.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <NewMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onSuccess={handleRefresh}
        contract={contract}
        summary={summary}
      />

      <RateChangeModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        onSuccess={handleRefresh}
        contract={contract}
      />

      <EditContractModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleRefresh}
        contract={contract}
      />
    </div>
  );
}
