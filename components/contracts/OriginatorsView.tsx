'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contract, Originator } from '../../types';
import { calculateContractSummary } from '../../lib/contractCalculator';
import { formatMoney } from '../../lib/formatters';
import NewOriginatorModal from './NewOriginatorModal';

interface OriginatorsViewProps {
  originators: Originator[];
  contracts: Contract[];
}

export default function OriginatorsView({ originators, contracts }: OriginatorsViewProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Agrupar métricas por originador
  const originatorMetrics = originators.map(org => {
    const orgContracts = contracts.filter(c => c.originator_id === org.id);
    let totalAUM = 0;
    let totalCommissions = 0;

    orgContracts.forEach(c => {
      const summary = calculateContractSummary(c);
      totalAUM += summary.total_capital;
      totalCommissions += summary.originator_accumulated_commissions;
    });

    return {
      originator: org,
      contractsCount: orgContracts.length,
      openContractsCount: orgContracts.filter(c => c.status === 'Open').length,
      totalAUM,
      totalCommissions
    };
  });

  const filtered = originatorMetrics.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.originator.name.toLowerCase().includes(q) ||
      (item.originator.email && item.originator.email.toLowerCase().includes(q)) ||
      (item.originator.phone && item.originator.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/dashboard/contracts" className="hover:text-indigo-600 transition-colors">
              Contracts
            </Link>
            <span>/</span>
            <span className="text-gray-700">Originators</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-2xl">👥</span>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Originators & Advisors
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Manage commercial originators, tracked assets under management, and accrued monthly commissions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/contracts"
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl shadow-xs transition-colors"
          >
            ← Back to Contracts
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>+</span>
            <span>New Originator</span>
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search originator name, email or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
            />
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {filtered.length} Advisor(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[11px] tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-3.5">Advisor Name</th>
                <th className="px-6 py-3.5">Contact Details</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-center">Total Contracts</th>
                <th className="px-6 py-3.5 text-right">Originated AUM</th>
                <th className="px-6 py-3.5 text-right text-purple-700">Accrued Commissions</th>
                <th className="px-6 py-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No originators found. Click &quot;New Originator&quot; to register one.
                  </td>
                </tr>
              ) : (
                filtered.map(({ originator, contractsCount, openContractsCount, totalAUM, totalCommissions }) => (
                  <tr key={originator.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-gray-900 text-sm">
                      {originator.name}
                    </td>
                    <td className="px-6 py-3.5 text-gray-600">
                      <div>{originator.email || <span className="text-gray-400 italic">No email</span>}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{originator.phone || ''}</div>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        originator.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {originator.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center font-mono">
                      <span className="font-bold text-gray-900">{contractsCount}</span>
                      <span className="text-gray-400 text-[11px] ml-1">({openContractsCount} Open)</span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-gray-900">
                      ${formatMoney(totalAUM)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-purple-700">
                      +${formatMoney(totalCommissions)}
                    </td>
                    <td className="px-6 py-3.5 text-gray-500 max-w-xs truncate">
                      {originator.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewOriginatorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
