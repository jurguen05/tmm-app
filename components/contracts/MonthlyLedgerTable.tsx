'use client';

import React from 'react';
import { ContractMonthlyLedgerRow } from '../../types';
import { formatMoney, formatPct } from '../../lib/formatters';

interface MonthlyLedgerTableProps {
  rows: ContractMonthlyLedgerRow[];
  hasOriginator: boolean;
}

export default function MonthlyLedgerTable({ rows, hasOriginator }: MonthlyLedgerTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
        No monthly records available for this contract.
      </div>
    );
  }

  // Totales acumulados
  const totalInterests = rows.reduce((sum, r) => sum + r.delta_interest, 0);
  const totalOriginator = rows.reduce((sum, r) => sum + r.delta_originator_commission, 0);
  const totalDeposits = rows.reduce((sum, r) => sum + r.delta_capital_deposit, 0);
  const totalCapWithdrawals = rows.reduce((sum, r) => sum + r.capital_withdrawal, 0);
  const totalIntWithdrawals = rows.reduce((sum, r) => sum + r.interest_withdrawal, 0);
  const finalCapital = rows[rows.length - 1].capital_end;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-gray-900 tracking-tight">Monthly Evolution Ledger</h4>
          <p className="text-xs text-gray-500">Compounding schedule by cutoff dates matching original Excel model</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg font-mono">
            {rows.length} Cutoffs
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-gray-50/80 text-gray-600 uppercase font-semibold text-[11px] tracking-wider border-b border-gray-200/80">
            <tr>
              <th className="px-4 py-3 text-center">#</th>
              <th className="px-4 py-3">Cutoff Date</th>
              <th className="px-4 py-3 text-right">Capital (t-1)</th>
              <th className="px-4 py-3 text-right">Investor Rate</th>
              <th className="px-4 py-3 text-right text-indigo-700">∆ Interests</th>
              {hasOriginator && (
                <th className="px-4 py-3 text-right text-purple-700">Originator Comm.</th>
              )}
              <th className="px-4 py-3 text-right text-emerald-700">∆ Capital</th>
              <th className="px-4 py-3 text-right text-amber-700">Cap. Withdrawals</th>
              <th className="px-4 py-3 text-right text-blue-700">Int. Withdrawals</th>
              <th className="px-4 py-3 text-right font-bold text-gray-900">Capital (t)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr 
                key={`${row.period_index}-${row.cutoff_date}`} 
                className="hover:bg-gray-50/70 transition-colors font-mono"
              >
                <td className="px-4 py-2.5 text-center text-gray-400 font-sans font-medium text-xs">
                  {row.period_index}
                </td>
                <td className="px-4 py-2.5 text-gray-700 font-sans font-medium">
                  {row.cutoff_date}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">
                  ${formatMoney(row.capital_prev)}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">
                  {formatPct(row.investor_rate * 100)}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-indigo-600">
                  {row.delta_interest > 0 ? `+$${formatMoney(row.delta_interest)}` : '$0.00'}
                </td>
                {hasOriginator && (
                  <td className="px-4 py-2.5 text-right text-purple-600 font-medium">
                    {row.delta_originator_commission > 0 ? `+$${formatMoney(row.delta_originator_commission)}` : '$0.00'}
                  </td>
                )}
                <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                  {row.delta_capital_deposit > 0 ? `+$${formatMoney(row.delta_capital_deposit)}` : '-'}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-amber-600">
                  {row.capital_withdrawal > 0 ? `-$${formatMoney(row.capital_withdrawal)}` : '-'}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-blue-600">
                  {row.interest_withdrawal > 0 ? `-$${formatMoney(row.interest_withdrawal)}` : '-'}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-gray-900 bg-gray-50/40">
                  ${formatMoney(row.capital_end)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100/80 font-bold border-t-2 border-gray-200 text-gray-900 font-mono">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right uppercase text-[11px] font-sans font-semibold text-gray-700">
                Totals / Final Balance:
              </td>
              <td className="px-4 py-3 text-right text-indigo-700">
                +${formatMoney(totalInterests)}
              </td>
              {hasOriginator && (
                <td className="px-4 py-3 text-right text-purple-700">
                  +${formatMoney(totalOriginator)}
                </td>
              )}
              <td className="px-4 py-3 text-right text-emerald-700">
                +${formatMoney(totalDeposits)}
              </td>
              <td className="px-4 py-3 text-right text-amber-700">
                -${formatMoney(totalCapWithdrawals)}
              </td>
              <td className="px-4 py-3 text-right text-blue-700">
                -${formatMoney(totalIntWithdrawals)}
              </td>
              <td className="px-4 py-3 text-right text-indigo-900 font-bold bg-indigo-50/50">
                ${formatMoney(finalCapital)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
