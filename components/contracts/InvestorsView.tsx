'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contract, Investor } from '../../types';
import { calculateContractSummary } from '../../lib/contractCalculator';
import { formatMoney } from '../../lib/formatters';
import NewInvestorModal from './NewInvestorModal';

interface InvestorsViewProps {
  investors: Investor[];
  contracts: Contract[];
}

export default function InvestorsView({ investors, contracts }: InvestorsViewProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Agrupar métricas por inversor
  const investorMetrics = investors.map(inv => {
    const invContracts = contracts.filter(c => c.investor_id === inv.id || c.investor_name.toLowerCase() === inv.name.toLowerCase());
    let totalCapital = 0;

    invContracts.forEach(c => {
      const summary = calculateContractSummary(c);
      totalCapital += summary.total_capital;
    });

    return {
      investor: inv,
      contractsCount: invContracts.length,
      openContractsCount: invContracts.filter(c => c.status === 'Open').length,
      totalCapital
    };
  });

  const filtered = investorMetrics.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.investor.name.toLowerCase().includes(q) ||
      (item.investor.email && item.investor.email.toLowerCase().includes(q)) ||
      (item.investor.phone && item.investor.phone.toLowerCase().includes(q)) ||
      (item.investor.tax_id && item.investor.tax_id.toLowerCase().includes(q))
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
            <span className="text-gray-700">Investors</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-2xl">👤</span>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Investors Directory
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Manage client profiles, contact information, tax identification, and payment details
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
            <span>New Investor</span>
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
              placeholder="Search by name, email, phone or Tax ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
            />
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {filtered.length} Investor(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[11px] tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-3.5">Investor Name</th>
                <th className="px-6 py-3.5">Tax ID / DNI</th>
                <th className="px-6 py-3.5">Contact Details</th>
                <th className="px-6 py-3.5">Payout / Settlement Details</th>
                <th className="px-6 py-3.5 text-center">Contracts</th>
                <th className="px-6 py-3.5 text-right">Total Active Capital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No investors found. Click &quot;New Investor&quot; to register a profile.
                  </td>
                </tr>
              ) : (
                filtered.map(({ investor, contractsCount, openContractsCount, totalCapital }) => (
                  <tr key={investor.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-gray-900 text-sm">
                      {investor.name}
                      {investor.address && (
                        <div className="text-[11px] text-gray-400 font-normal">{investor.address}</div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-gray-700">
                      {investor.tax_id ? (
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          {investor.tax_id}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-gray-600">
                      <div>{investor.email || <span className="text-gray-400 italic">No email</span>}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{investor.phone || ''}</div>
                    </td>
                    <td className="px-6 py-3.5 text-gray-600 font-mono text-[11px] max-w-xs truncate">
                      {investor.payout_info || <span className="text-gray-400 italic font-sans">No payout info</span>}
                    </td>
                    <td className="px-6 py-3.5 text-center font-mono">
                      <span className="font-bold text-gray-900">{contractsCount}</span>
                      <span className="text-gray-400 text-[11px] ml-1">({openContractsCount} Open)</span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-gray-900">
                      ${formatMoney(totalCapital)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewInvestorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
