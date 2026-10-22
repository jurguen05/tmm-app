'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contract, Originator, Investor, Contact } from '../../types';
import { calculateContractSummary } from '../../lib/contractCalculator';
import { formatMoney, formatPct } from '../../lib/formatters';
import NewContractModal from './NewContractModal';
import NewOriginatorModal from './NewOriginatorModal';
import NewInvestorModal from './NewInvestorModal';
import NewContactModal from './NewContactModal';

interface ContractsDashboardProps {
  initialContracts: Contract[];
  initialOriginators: Originator[];
  initialInvestors?: Investor[];
  initialContacts?: Contact[];
  isInvestor?: boolean;
}

export default function ContractsDashboard({
  initialContracts,
  initialOriginators,
  initialInvestors = [],
  initialContacts = [],
  isInvestor = false
}: ContractsDashboardProps) {
  const router = useRouter();
  const [contracts] = useState<Contract[]>(initialContracts);
  const [originators, setOriginators] = useState<Originator[]>(initialOriginators);
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isOriginatorModalOpen, setIsOriginatorModalOpen] = useState(false);
  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Closed'>('All');

  // Calcular métricas de cada contrato
  const contractsWithSummary = contracts.map(c => {
    const summary = calculateContractSummary(c);
    const activeRate = c.rates && c.rates.length > 0
      ? c.rates[c.rates.length - 1].investor_annual_rate
      : 0;
    return {
      contract: c,
      summary,
      activeRate
    };
  });

  // Métricas agregadas
  const totalAUM = contractsWithSummary.reduce((sum, item) => sum + item.summary.total_capital, 0);
  const totalOpenContracts = contractsWithSummary.filter(item => item.contract.status === 'Open').length;
  const totalLockedCapital = contractsWithSummary.reduce((sum, item) => sum + item.summary.locked_capital, 0);
  const totalWithdrawableCapital = contractsWithSummary.reduce((sum, item) => sum + item.summary.withdrawable_capital, 0);
  const totalAccumulatedInterest = contractsWithSummary.reduce((sum, item) => sum + item.summary.accumulated_interest, 0);

  // Filtrado
  const filtered = contractsWithSummary.filter(item => {
    const matchesStatus = statusFilter === 'All' || item.contract.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.contract.investor_name.toLowerCase().includes(q) ||
      item.contract.contract_number.toLowerCase().includes(q) ||
      (item.contract.originator?.name && item.contract.originator.name.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📑</span>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {isInvestor ? 'My Investment Contracts' : 'Investor Contracts Management'}
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {isInvestor 
              ? 'Your active capital, compounding monthly returns, and withdrawal eligibility'
              : 'Track capital, monthly compounding interest, lockup rules, and advisor commissions'}
          </p>
        </div>

        {!isInvestor && (
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/contracts/contacts"
              className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>📇</span>
              <span>Contacts Directory ({contacts.length})</span>
            </Link>
            <button
              onClick={() => setIsContractModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>New Contract</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total AUM */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total AUM</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold font-mono">USD</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 font-mono mt-2">
            ${formatMoney(totalAUM)}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <span className="font-semibold text-emerald-600">{totalOpenContracts} Open</span>
            <span>•</span>
            <span>{contracts.length - totalOpenContracts} Closed</span>
          </div>
        </div>

        {/* Withdrawable Capital */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Eligible Capital</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">&gt; 6 Months</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono mt-2">
            ${formatMoney(totalWithdrawableCapital)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Free for unrestricted capital withdrawal
          </div>
        </div>

        {/* Locked Capital */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Locked Capital</span>
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium">&lt; 6 Months</span>
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono mt-2">
            ${formatMoney(totalLockedCapital)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Early withdrawal requires agreement
          </div>
        </div>

        {/* Total Accrued Interest */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Accrued Interest</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium">Lifetime</span>
          </div>
          <div className="text-2xl font-bold text-indigo-700 font-mono mt-2">
            +${formatMoney(totalAccumulatedInterest)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Compound interest generated to date
          </div>
        </div>
      </div>

      {/* Contracts Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {/* Table Header & Filters */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative w-full">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search investor, contract #, or advisor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('All')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'All' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                All ({contracts.length})
              </button>
              <button
                onClick={() => setStatusFilter('Open')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'Open' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Open ({totalOpenContracts})
              </button>
              <button
                onClick={() => setStatusFilter('Closed')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'Closed' ? 'bg-white text-gray-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Closed ({contracts.length - totalOpenContracts})
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[11px] tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-3.5">Contract #</th>
                <th className="px-6 py-3.5">Investor</th>
                <th className="px-6 py-3.5">Originator / Advisor</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-center">Cutoff Day</th>
                <th className="px-6 py-3.5 text-right">Investor Rate</th>
                <th className="px-6 py-3.5 text-right">Total Capital</th>
                <th className="px-6 py-3.5 text-right text-emerald-700">Eligible (&gt;6m)</th>
                <th className="px-6 py-3.5 text-right text-amber-700">Locked (&lt;6m)</th>
                <th className="px-6 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                    No contracts found matching your filters.
                  </td>
                </tr>
              ) : (
                filtered.map(({ contract, summary, activeRate }) => (
                  <tr key={contract.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-medium text-indigo-600">
                      <Link href={`/dashboard/contracts/${contract.id}`} className="hover:underline">
                        {contract.contract_number}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-gray-900 text-sm">
                      <Link href={`/dashboard/contracts/${contract.id}`} className="hover:text-indigo-600">
                        {contract.investor_name}
                      </Link>
                      <div className="text-[11px] text-gray-400 font-sans">
                        Since {contract.start_date}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-gray-700">
                      {contract.originator ? (
                        <div>
                          <span className="font-medium text-gray-900">{contract.originator.name}</span>
                          {contract.rates && contract.rates.length > 0 && contract.rates[contract.rates.length - 1].originator_annual_rate > 0 && (
                            <span className="ml-1.5 text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono font-bold">
                              {formatPct(contract.rates[contract.rates.length - 1].originator_annual_rate * 100)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        contract.status === 'Open'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center font-mono text-gray-600">
                      <div className="font-semibold">Day {contract.cutoff_day}</div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-gray-100 text-gray-700 capitalize">
                        {contract.payout_frequency ? contract.payout_frequency.toLowerCase().replace('_', ' ') : 'on demand'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-gray-900">
                      {formatPct(activeRate * 100)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-gray-900">
                      ${formatMoney(summary.total_capital)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-emerald-700">
                      ${formatMoney(summary.withdrawable_capital)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-amber-700 font-medium">
                      {summary.locked_capital > 0 ? (
                        <span className="bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          ${formatMoney(summary.locked_capital)}
                        </span>
                      ) : (
                        '$0.00'
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <Link
                        href={`/dashboard/contracts/${contract.id}`}
                        className="px-3 py-1 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <NewContractModal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        onSuccess={handleRefresh}
        originators={originators}
        investors={investors}
        onOpenNewOriginator={() => setIsContactModalOpen(true)}
        onOpenNewInvestor={() => setIsContactModalOpen(true)}
      />

      <NewContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSuccess={(created) => {
          setContacts(prev => [...prev, created]);
          if (created.is_investor) setInvestors(prev => [...prev, created]);
          if (created.is_originator) setOriginators(prev => [...prev, created]);
          handleRefresh();
        }}
      />

      <NewOriginatorModal
        isOpen={isOriginatorModalOpen}
        onClose={() => setIsOriginatorModalOpen(false)}
        onSuccess={(created) => {
          setOriginators(prev => [...prev, created]);
          handleRefresh();
        }}
      />

      <NewInvestorModal
        isOpen={isInvestorModalOpen}
        onClose={() => setIsInvestorModalOpen(false)}
        onSuccess={(created) => {
          setInvestors(prev => [...prev, created]);
          handleRefresh();
        }}
      />
    </div>
  );
}
