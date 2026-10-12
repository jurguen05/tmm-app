'use client'

import { useState, useMemo, useEffect } from 'react'
import { Position } from '../types'
import { formatearMoneda } from '../lib/formatters'
import PaginationControls from './PaginationControls'

interface PositionsTableProps {
  posiciones: Position[]
}

export default function PositionsTable({ posiciones }: PositionsTableProps) {
  const [busqueda, setBusqueda] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const [elementosPorPagina, setElementosPorPagina] = useState(25)

  const thBase = "px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center";
  const tdCenter = "px-4 py-3 text-sm text-gray-800 font-normal text-center whitespace-nowrap";
  const tdRight = "px-4 py-3 text-sm text-gray-800 font-normal text-right whitespace-nowrap";

  // Función sin colores para Delta y Theta
  const formatPlainNumber = (val: number | null | undefined) => {
    if (!val) return <span className="text-gray-400">0.00</span>;
    return <span className="text-gray-800">{val.toFixed(2)}</span>;
  }

  // Filtrado por símbolo o unique_key
  const posicionesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return posiciones
    const q = busqueda.toLowerCase().trim()
    return posiciones.filter(p => 
      (p.symbol && p.symbol.toLowerCase().includes(q)) ||
      (p.unique_key && p.unique_key.toLowerCase().includes(q))
    )
  }, [posiciones, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(posicionesFiltradas.length / elementosPorPagina))
  const paginaValida = Math.min(Math.max(1, paginaActual), totalPaginas)

  const handleBusquedaChange = (valor: string) => {
    setBusqueda(valor)
    setPaginaActual(1)
  }

  // Paginación
  const indiceInicio = (paginaValida - 1) * elementosPorPagina
  const posicionesPaginadas = useMemo(() => {
    return posicionesFiltradas.slice(indiceInicio, indiceInicio + elementosPorPagina)
  }, [posicionesFiltradas, indiceInicio, elementosPorPagina])

  return (
    <div className="space-y-4">
      {/* Barra de Búsqueda */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-500">Buscar por Símbolo o Clave:</label>
          <input
            type="text"
            placeholder="Ej: AAPL, SPY..."
            value={busqueda}
            onChange={(e) => handleBusquedaChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-52"
          />
          {busqueda && (
            <button
              onClick={() => handleBusquedaChange('')}
              className="text-xs text-gray-500 hover:text-indigo-600 underline"
            >
              Limpiar
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500 font-medium">
          {posicionesFiltradas.length} {posicionesFiltradas.length === 1 ? 'posición' : 'posiciones'} en total
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
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
              {posicionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                    {busqueda 
                      ? `No hay posiciones que coincidan con "${busqueda}".` 
                      : 'No hay posiciones cargadas. Subí un archivo Position Statement para ver tu foto actual.'}
                  </td>
                </tr>
              ) : (
                posicionesPaginadas.map((p) => (
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

        {/* Paginación */}
        {posicionesFiltradas.length > 0 && (
          <PaginationControls
            currentPage={paginaValida}
            totalItems={posicionesFiltradas.length}
            pageSize={elementosPorPagina}
            pageSizeOptions={[15, 25, 50, 100]}
            onPageChange={setPaginaActual}
            onPageSizeChange={(newSize) => {
              setElementosPorPagina(newSize)
              setPaginaActual(1)
            }}
            itemName="posiciones"
          />
        )}
      </div>
    </div>
  )
}