'use client'

import { useState } from 'react'
import { Transaction, Strategy } from '../types'
import { formatearMoneda, formatearFecha } from '../lib/formatters'

interface TransactionsTableProps {
  transacciones: Transaction[]
  estrategias: Strategy[]
  selectedIds: string[]
  onToggleSeleccion: (id: string) => void
  onToggleSeleccionarTodas: () => void
  onActualizarTransaccion: (id: string, campo: string, valor: any) => void
}

export default function TransactionsTable({
  transacciones,
  estrategias,
  selectedIds,
  onToggleSeleccion,
  onToggleSeleccionarTodas,
  onActualizarTransaccion
}: TransactionsTableProps) {

  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  
  // CLASES PARA LOS ENCABEZADOS (Todos centrados)
  const thBase = "px-4 py-3 text-xs font-medium text-gray-500 uppercase";
  const thCenter = `${thBase} text-center`;

  // CLASES PARA LOS DATOS (Textos al centro, números a la derecha)
  const tdBase = "px-4 py-3 text-sm text-gray-800 font-normal";
  const tdCenter = `${tdBase} text-center`;
  const tdRight = `${tdBase} text-right whitespace-nowrap`;
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-center">
              <input 
                type="checkbox" 
                onChange={onToggleSeleccionarTodas} 
                checked={transacciones.length > 0 && transacciones.every((t) => selectedIds.includes(t.id))} 
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
              />
            </th>
            <th className={thCenter}>Code</th>
            <th className={thCenter}>Strategy</th>
            <th className={thCenter}>Symbol</th>
            <th className={thCenter}>Date</th>
            <th className={thCenter}>Instrument</th>
            <th className={thCenter}>Action</th>
            <th className={thCenter}>Stock Entry Price</th>
            <th className={thCenter}>Quantity</th>
            <th className={thCenter}>Price</th>
           {/*<th className={thCenter}>Fees</th>*/}
            <th className={thCenter}>Amount</th>
            <th className={thCenter}>Status</th>
          {/*<th className={thCenter}>UniqueKey</th>*/}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {transacciones.length === 0 ? (
            <tr>
              <td colSpan={14} className="px-6 py-8 text-center text-gray-500">
                No hay transacciones que coincidan con tu búsqueda.
              </td>
            </tr>
          ) : (
            transacciones.map((t) => (
              <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(t.id) ? 'bg-indigo-50' : ''}`}>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => onToggleSeleccion(t.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                </td>
                
                <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-center">{t.trade_code || '-'}</td>
                
                <td className="px-4 py-3 text-sm text-gray-600 text-center">
                  <select 
                    value={t.strategy_id || ''} 
                    onChange={(e) => {
                      const nuevoId = e.target.value ? Number(e.target.value) : null;
                      onActualizarTransaccion(t.id, 'strategy_id', nuevoId);
                    }} 
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                  >
                    <option value="">Seleccionar...</option>
                    {estrategias.map(est => (
                      <option key={est.id} value={est.id}>{est.name}</option>
                    ))}
                  </select>
                </td>
                
                <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-center">{t.symbol}</td>
                <td className={`${tdCenter} whitespace-nowrap`}>{formatearFecha(t.date)}</td>
                <td className={tdCenter}>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${t.instrument === 'Stock' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{t.instrument}</span>
                </td>
                <td className={tdCenter}>{t.action}</td>
                
                {/* Stock Entry Price */}
                <td className={tdRight}>
                  {t.instrument === 'Option' ? (
                    editingPriceId === t.id ? (
                      <input 
                        type="number" 
                        autoFocus
                        onBlur={() => setEditingPriceId(null)}
                        value={t.stock_entry_price || ''} 
                        onChange={(e) => onActualizarTransaccion(t.id, 'stock_entry_price', parseFloat(e.target.value) || null)} 
                        placeholder="0.00" 
                        className="w-20 px-2 py-1 border border-indigo-500 rounded text-sm font-normal focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right" 
                      />
                    ) : (
                      <div 
                        onClick={() => setEditingPriceId(t.id)} 
                        className="cursor-text w-full px-2 py-1 border border-transparent hover:bg-gray-100 hover:border-gray-300 rounded text-sm transition-all"
                        title="Hacé clic para editar"
                      >
                        {t.stock_entry_price ? formatearMoneda(t.stock_entry_price) : <span className="text-gray-400">0,00</span>}
                      </div>
                    )
                  ) : (
                    t.stock_entry_price ? formatearMoneda(t.stock_entry_price) : '-'
                  )}
                </td>
                
                <td className={tdCenter}>{t.quantity}</td>
                <td className={tdRight}>{formatearMoneda(t.price)}</td>
                {/*<td className={tdRight}>{formatearMoneda(t.fees)}</td>*/}
                <td className={tdRight}>{formatearMoneda(t.amount)}</td>
                
                <td className="px-4 py-3 text-sm text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.position_status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{t.position_status || 'Open'}</span>
                </td>
                
                 {/*<td className="px-4 py-3 text-sm text-gray-900 font-bold whitespace-nowrap text-center">{t.unique_key}</td>*/}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}