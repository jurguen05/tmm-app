'use client'

import { Position } from '../types'
import { formatearMoneda } from '../lib/formatters'

interface PositionsTableProps {
  posiciones: Position[]
}

export default function PositionsTable({ posiciones }: PositionsTableProps) {
  
  const thBase = "px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center";
  const tdCenter = "px-4 py-3 text-sm text-gray-800 font-normal text-center whitespace-nowrap";
  const tdRight = "px-4 py-3 text-sm text-gray-800 font-normal text-right whitespace-nowrap";

  // Función sin colores para Delta y Theta
  const formatPlainNumber = (val: number | null | undefined) => {
    if (!val) return <span className="text-gray-400">0.00</span>;
    return <span className="text-gray-800">{val.toFixed(2)}</span>;
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className={thBase}>Unique Key</th>
            <th className={thBase}>Symbol</th>
            <th className={thBase}>Qty</th>
            <th className={thBase}>Days</th>
            <th className={thBase}>Trade Price</th>
            <th className={thBase}>Stock Mark</th>
            <th className={thBase}>Stock Last</th>
            <th className={thBase}>Delta Pos</th>
            <th className={thBase}>Theta</th>
            <th className={thBase}>Opt Delta</th>
            <th className={thBase}>Opt Theta</th>
            <th className={thBase}>Net Liq</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {posiciones.length === 0 ? (
            <tr>
              <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                No hay posiciones cargadas. Subí un archivo Position Statement para ver tu foto actual.
              </td>
            </tr>
          ) : (
            posiciones.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-center">{p.unique_key}</td>
                <td className="px-4 py-3 text-sm font-semibold text-indigo-600 text-center">{p.symbol}</td>
                <td className={tdRight}>{p.quantity}</td>
                <td className={tdRight}>{p.days || '-'}</td>
                <td className={tdRight}>{formatearMoneda(p.trade_price)}</td>
                <td className={tdRight}>{formatearMoneda(p.stock_mark)}</td>
                <td className={tdRight}>{formatearMoneda(p.stock_last)}</td>
                <td className={tdRight}>{formatPlainNumber(p.delta_position)}</td>
                <td className={tdRight}>{formatPlainNumber(p.theta)}</td>
                <td className={tdRight}>{formatPlainNumber(p.option_delta)}</td>
                <td className={tdRight}>{formatPlainNumber(p.option_theta)}</td>
                <td className={tdRight}>{formatearMoneda(p.net_liq)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}