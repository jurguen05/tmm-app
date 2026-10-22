'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Contact, Contract } from '../../types';
import { calculateContractSummary } from '../../lib/contractCalculator';
import { formatMoney } from '../../lib/formatters';
import NewContactModal from './NewContactModal';
import InviteModal from './InviteModal';

interface ContactsViewProps {
  contacts: Contact[];
  contracts: Contract[];
}

export default function ContactsView({ contacts, contracts }: ContactsViewProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [invitingContact, setInvitingContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'INVESTOR' | 'ORIGINATOR' | 'OPERATOR'>('ALL');

  // Métricas consolidadas por contacto (visión 360)
  const contactMetrics = contacts.map(c => {
    const investorContracts = contracts.filter(con => con.investor_id === c.id || con.investor_name.toLowerCase() === c.name.toLowerCase());
    const originatorContracts = contracts.filter(con => con.originator_id === c.id);

    let totalAUM = 0;
    investorContracts.forEach(con => {
      const summary = calculateContractSummary(con);
      totalAUM += summary.total_capital;
    });

    let totalCommissions = 0;
    originatorContracts.forEach(con => {
      const summary = calculateContractSummary(con);
      totalCommissions += summary.originator_accumulated_commissions;
    });

    return {
      contact: c,
      investorContractsCount: investorContracts.length,
      originatorContractsCount: originatorContracts.length,
      totalAUM,
      totalCommissions
    };
  });

  const filtered = contactMetrics.filter(item => {
    const c = item.contact;
    const matchesRole =
      roleFilter === 'ALL' ||
      (roleFilter === 'INVESTOR' && c.is_investor) ||
      (roleFilter === 'ORIGINATOR' && c.is_originator) ||
      (roleFilter === 'OPERATOR' && c.role_id === 1);

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.country && c.country.toLowerCase().includes(q)) ||
      (c.tax_id && c.tax_id.toLowerCase().includes(q));

    return matchesRole && matchesSearch;
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
            <span className="text-gray-700">Contacts & Directory</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📇</span>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Contacts & Entities Directory
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Unified Party Model: Single profile for investors and advisors with multi-role assignment
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
            type="button"
            onClick={() => {
              setInvitingContact(null);
              setIsInviteModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>📨</span>
            <span>Invite Link</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingContact(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>+</span>
            <span>New Contact</span>
          </button>
        </div>
      </div>

      {/* Directory Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search name, email, country, phone or Tax ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
            />
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                roleFilter === 'ALL' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All ({contacts.length})
            </button>
            <button
              onClick={() => setRoleFilter('INVESTOR')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                roleFilter === 'INVESTOR' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Investors ({contacts.filter(c => c.is_investor).length})
            </button>
            <button
              onClick={() => setRoleFilter('ORIGINATOR')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                roleFilter === 'ORIGINATOR' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Originators ({contacts.filter(c => c.is_originator).length})
            </button>
            <button
              onClick={() => setRoleFilter('OPERATOR')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                roleFilter === 'OPERATOR' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Team / Operators ({contacts.filter(c => c.role_id === 1).length})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase font-semibold text-[11px] tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-3.5">Contact Name</th>
                <th className="px-6 py-3.5 text-center">Commercial Roles</th>
                <th className="px-6 py-3.5 text-center">System Roles</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Country</th>
                <th className="px-6 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No contacts found. Click &quot;New Contact&quot; to register a profile.
                  </td>
                </tr>
              ) : (
                filtered.map(({ contact }) => (
                  <tr key={contact.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-gray-900 text-sm">
                      {contact.name}
                      {contact.phone && (
                        <div className="text-[11px] text-gray-400 font-mono font-normal">{contact.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        {contact.is_investor && (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            INV
                          </span>
                        )}
                        {contact.is_originator && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            ORG
                          </span>
                        )}
                        {!contact.is_investor && !contact.is_originator && (
                          <span className="text-gray-400 italic text-[11px]">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {contact.role_id === 1 ? (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">
                          OPERATOR
                        </span>
                      ) : contact.role_id === 2 ? (
                        <span className="bg-indigo-50 text-indigo-800 border border-indigo-300 font-bold px-2 py-0.5 rounded text-[10px]">
                          PORTAL
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">No Login</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-gray-700 font-mono">
                      {contact.email || <span className="text-gray-400 italic font-sans">No email</span>}
                    </td>
                    <td className="px-6 py-3.5 text-gray-800">
                      {contact.country ? (
                        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded-lg text-xs font-medium">
                          <span>📍</span>
                          <span>{contact.country}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setInvitingContact(contact);
                            setIsInviteModalOpen(true);
                          }}
                          title="Generate onboarding invitation link"
                          className="px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>📨</span>
                          <span>Invite</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingContact(contact);
                            setIsModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewContactModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingContact(null);
        }}
        contactToEdit={editingContact}
        onSuccess={() => router.refresh()}
      />

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setInvitingContact(null);
        }}
        contact={invitingContact}
      />
    </div>
  );
}
