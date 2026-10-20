'use client'

import { useState, useMemo } from 'react'
import { Position } from '../types'
import { formatearMoneda } from '../lib/formatters'
import PaginationControls from './PaginationControls'

interface PositionsTableProps {
  posiciones: Position[]
}

type SortField = 'none' | 'days' | 'symbol' | 'net_liq' | 'quantity'
type SortDirection = 'asc' | 'desc'
type PositionTypeFilter = 'all' | 'options' | 'stocks'

export default function PositionsTable({ posiciones }: PositionsTableProps) {
  const [busqueda, setBusqueda] = useState('')
  const [tipoPosicion, setTipoPosicion] = useState<PositionTypeFilter>('all')
  const [maxDays, setMaxDays] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('none')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [paginaActual, setPaginaActual] = useState(1)
  const [elementosPorPagina, setElementosPorPagina] = useState(25)

  const thBase = "px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center"
  const tdRight = "px-4 py-3 text-sm text-gray-800 font-normal text-right whitespace-nowrap"

  // Formateador sin colores para Delta y Theta
  const formatPlainNumber = (val: number | null | undefined) => {
    if (!val) return <span className="text-gray-400">0.00</span>
    return <span className="text-gray-800">{val.toFixed(2)}</span>
  }

  // Alternar ordenamiento por columna
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortField('none')
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setPaginaActual(1)
  }

  // Manejar selector de orden en la barra de filtros
  const handleSortDropdownChange = (val: string) => {
    if (val === 'none') {
      setSortField('none')
      setSortDirection('asc')
    } else {
      const [field, dir] = val.split('_') as [SortField, SortDirection]
      setSortField(field)
      setSortDirection(dir || 'asc')
    }
    setPaginaActual(1)
  }

  // 1. Filtrado
  const posicionesFiltradas = useMemo(() => {
    return posiciones.filter(p => {
      // Búsqueda por texto (símbolo o unique_key)
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim()
        const matchSymbol = p.symbol && p.symbol.toLowerCase().includes(q)
        const matchKey = p.unique_key && p.unique_key.toLowerCase().includes(q)
        if (!matchSymbol && !matchKey) return false
      }

      // Filtro por tipo de instrumento y días de vencimiento
      const days = p.days ?? 0
      const isOption = days > 0

      if (tipoPosicion === 'options' && !isOption) return false
      if (tipoPosicion === 'stocks' && isOption) return false

      if (maxDays.trim()) {
        const limit = parseInt(maxDays.trim(), 10)
        if (!isNaN(limit)) {
          if (days <= 0 || days > limit) return false
        }
      }

      return true
    })
  }, [posiciones, busqueda, tipoPosicion, maxDays])

  // 2. Ordenamiento
  const posicionesOrdenadas = useMemo(() => {
    if (sortField === 'none') return posicionesFiltradas

    return [...posicionesFiltradas].sort((a, b) => {
      if (sortField === 'days') {
        const aDays = a.days ?? 0
        const bDays = b.days ?? 0

        // Si uno no tiene vencimiento (<= 0), enviarlo al final
        if (aDays <= 0 && bDays > 0) return 1
        if (bDays <= 0 && aDays > 0) return -1
        if (aDays <= 0 && bDays <= 0) return 0

        return sortDirection === 'asc' ? aDays - bDays : bDays - aDays
      }

      if (sortField === 'symbol') {
        const aSym = a.symbol || ''
        const bSym = b.symbol || ''
        return sortDirection === 'asc'
          ? aSym.localeCompare(bSym)
          : bSym.localeCompare(aSym)
      }

      if (sortField === 'net_liq') {
        const aVal = a.net_liq ?? 0
        const bVal = b.net_liq ?? 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      if (sortField === 'quantity') {
        const aVal = a.quantity ?? 0
        const bVal = b.quantity ?? 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      return 0
    })
  }, [posicionesFiltradas, sortField, sortDirection])

  const totalPaginas = Math.max(1, Math.ceil(posicionesOrdenadas.length / elementosPorPagina))
  const paginaValida = Math.min(Math.max(1, paginaActual), totalPaginas)

  const handleBusquedaChange = (valor: string) => {
    setBusqueda(valor)
    setPaginaActual(1)
  }

  const hayFiltrosActivos = busqueda.trim() !== '' || tipoPosicion !== 'all' || maxDays.trim() !== '' || sortField !== 'none'

  const handleLimpiarFiltros = () => {
    setBusqueda('')
    setTipoPosicion('all')
    setMaxDays('')
    setSortField('none')
    setSortDirection('asc')
    setPaginaActual(1)
  }

  // 3. Paginación
  const indiceInicio = (paginaValida - 1) * elementosPorPagina
  const posicionesPaginadas = useMemo(() => {
    return posicionesOrdenadas.slice(indiceInicio, indiceInicio + elementosPorPagina)
  }, [posicionesOrdenadas, indiceInicio, elementosPorPagina])

  // Helper para renderizar indicador de orden en encabezados
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-gray-300 group-hover:text-gray-500 text-xs">↕</span>
    }
    return <span className="text-indigo-600 font-bold text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Ordenamiento */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4 flex-1">
          {/* Búsqueda */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search Symbol / Key</label>
            <input
              type="text"
              placeholder="e.g. AAPL, SPY..."
              value={busqueda}
              onChange={(e) => handleBusquedaChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-44"
            />
          </div>

          {/* Tipo de Instrumento */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={tipoPosicion}
              onChange={(e) => {
                setTipoPosicion(e.target.value as PositionTypeFilter)
                setPaginaActual(1)
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="all">All Positions</option>
              <option value="options">Options Only</option>
              <option value="stocks">Stocks Only</option>
            </select>
          </div>

          {/* Filtro por Días al Vencimiento (≤ Días) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Expiration ≤ (Days)</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                placeholder="e.g. 110"
                value={maxDays}
                onChange={(e) => {
                  setMaxDays(e.target.value)
                  setPaginaActual(1)
                }}
                className="px-3 py-1.5 pr-7 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-32"
              />
              {maxDays && (
                <button
                  type="button"
                  onClick={() => {
                    setMaxDays('')
                    setPaginaActual(1)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer font-bold"
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Selector de Orden */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sort by</label>
            <select
              value={sortField === 'none' ? 'none' : `${sortField}_${sortDirection}`}
              onChange={(e) => handleSortDropdownChange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="none">Default</option>
              <option value="days_asc">Days (Fewest first)</option>
              <option value="days_desc">Days (Most first)</option>
              <option value="symbol_asc">Symbol (A - Z)</option>
              <option value="symbol_desc">Symbol (Z - A)</option>
              <option value="net_liq_desc">Net Liq (Highest first)</option>
              <option value="net_liq_asc">Net Liq (Lowest first)</option>
              <option value="quantity_desc">Quantity (Highest first)</option>
            </select>
          </div>

          {/* Botón Reset */}
          {hayFiltrosActivos && (
            <button
              onClick={handleLimpiarFiltros}
              className="px-2 py-1.5 text-xs text-gray-500 hover:text-indigo-600 font-medium underline cursor-pointer mb-0.5"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Contador */}
        <div className="text-xs text-gray-500 font-medium">
          {posicionesOrdenadas.length} {posicionesOrdenadas.length === 1 ? 'position' : 'positions'}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className={thBase}>Unique Key</th>
                <th 
                  onClick={() => toggleSort('symbol')}
                  className="px-4 py-3 text-xs font-medium text-center uppercase cursor-pointer hover:bg-gray-200 transition-colors select-none group"
                  title="Click to sort by Symbol"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span className={sortField === 'symbol' ? 'font-bold text-indigo-600' : 'text-gray-500'}>Symbol</span>
                    {renderSortIndicator('symbol')}
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('quantity')}
                  className="px-4 py-3 text-xs font-medium text-right uppercase cursor-pointer hover:bg-gray-200 transition-colors select-none group"
                  title="Click to sort by Qty"
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span className={sortField === 'quantity' ? 'font-bold text-indigo-600' : 'text-gray-500'}>Qty</span>
                    {renderSortIndicator('quantity')}
                  </div>
                </th>
                {/* Columna Days ordenable */}
                <th 
                  onClick={() => toggleSort('days')}
                  className="px-4 py-3 text-xs font-medium text-right uppercase cursor-pointer hover:bg-gray-200 transition-colors select-none group"
                  title="Click to sort by Days to expiration"
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span className={sortField === 'days' ? 'font-bold text-indigo-600' : 'text-gray-500'}>Days</span>
                    {renderSortIndicator('days')}
                  </div>
                </th>
                <th className={thBase}>Trade Price</th>
                <th className={thBase}>Stock Mark</th>
                <th className={thBase}>Stock Last</th>
                <th className={thBase}>Delta Pos</th>
                <th className={thBase}>Theta</th>
                <th className={thBase}>Opt Delta</th>
                <th className={thBase}>Opt Theta</th>
                <th 
                  onClick={() => toggleSort('net_liq')}
                  className="px-4 py-3 text-xs font-medium text-right uppercase cursor-pointer hover:bg-gray-200 transition-colors select-none group"
                  title="Click to sort by Net Liq"
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span className={sortField === 'net_liq' ? 'font-bold text-indigo-600' : 'text-gray-500'}>Net Liq</span>
                    {renderSortIndicator('net_liq')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {posicionesOrdenadas.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                    {hayFiltrosActivos 
                      ? 'No positions match the current filters.' 
                      : 'No positions loaded. Upload a Position Statement to see your current portfolio.'}
                  </td>
                </tr>
              ) : (
                posicionesPaginadas.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-center">{p.unique_key}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-indigo-600 text-center">{p.symbol}</td>
                    <td className={tdRight}>{p.quantity}</td>
                    <td className={tdRight}>
                      {p.days && p.days > 0 ? (
                        <span className={`font-semibold ${p.days <= 7 ? 'text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-xs' : 'text-gray-900'}`}>
                          {p.days}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
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
        {posicionesOrdenadas.length > 0 && (
          <PaginationControls
            currentPage={paginaValida}
            totalItems={posicionesOrdenadas.length}
            pageSize={elementosPorPagina}
            pageSizeOptions={[15, 25, 50, 100]}
            onPageChange={setPaginaActual}
            onPageSizeChange={(newSize) => {
              setElementosPorPagina(newSize)
              setPaginaActual(1)
            }}
            itemName="positions"
          />
        )}
      </div>
    </div>
  )
}