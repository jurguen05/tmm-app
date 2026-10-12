'use client'

import { useState, useMemo, useEffect } from 'react'
import PaginationControls from './PaginationControls'

interface StrategyData {
  id: string;
  trade_code: string;
  symbol: string;
  strategy: string;
  entryPrice: number;
  lastPrice: number;
  stop: string | number;
  rentabilidad: number;
}

interface TableProps {
  datos: StrategyData[];
  cargando: boolean;
}

// Formateador de moneda (Argentina)
const formatoMoneda = (valor: number) => {
  if (!valor) return '0,00';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
};

// Formateador de porcentaje
const formatoPorcentaje = (valor: number) => {
  if (!valor) return '0,00%';
  return new Intl.NumberFormat('es-AR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
};

export default function StrategiesStopsTable({ datos, cargando }: TableProps) {
  const [busqueda, setBusqueda] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const [elementosPorPagina, setElementosPorPagina] = useState(25)

  const datosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return datos
    const q = busqueda.toLowerCase().trim()
    return datos.filter(d => 
      (d.symbol && d.symbol.toLowerCase().includes(q)) ||
      (d.strategy && d.strategy.toLowerCase().includes(q)) ||
      (d.trade_code && d.trade_code.toString().toLowerCase().includes(q))
    )
  }, [datos, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(datosFiltrados.length / elementosPorPagina))
  const paginaValida = Math.min(Math.max(1, paginaActual), totalPaginas)

  const handleBusquedaChange = (valor: string) => {
    setBusqueda(valor)
    setPaginaActual(1)
  }

  // Paginación
  const indiceInicio = (paginaValida - 1) * elementosPorPagina
  const datosPaginados = useMemo(() => {
    return datosFiltrados.slice(indiceInicio, indiceInicio + elementosPorPagina)
  }, [datosFiltrados, indiceInicio, elementosPorPagina])

  if (cargando) {
    return <div className="text-center p-8 text-gray-500">Cruzando datos y calculando métricas...</div>;
  }

  if (!datos || datos.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow border border-gray-200 text-center text-gray-500">
        No hay posiciones vigentes para analizar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtro */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-500">Buscar Posición:</label>
          <input
            type="text"
            placeholder="Ej: AAPL, Código, Estrategia..."
            value={busqueda}
            onChange={(e) => handleBusquedaChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-64"
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
          {datosFiltrados.length} {datosFiltrados.length === 1 ? 'posición' : 'posiciones'} vigentes
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Code</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Symbol</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Strategy</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Entry Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Last</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Stop</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rentabilidad</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {datosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No hay posiciones que coincidan con &quot;{busqueda}&quot;.
                  </td>
                </tr>
              ) : (
                datosPaginados.map((fila) => (
                  <tr key={fila.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{fila.trade_code}</td>
                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{fila.symbol}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-semibold">
                        {fila.strategy}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{formatoMoneda(fila.entryPrice)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{formatoMoneda(fila.lastPrice)}</td>
                    <td className="px-4 py-3 text-right text-gray-400 whitespace-nowrap italic">{fila.stop}</td>
                    <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${fila.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatoPorcentaje(fila.rentabilidad)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {datosFiltrados.length > 0 && (
          <PaginationControls
            currentPage={paginaValida}
            totalItems={datosFiltrados.length}
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