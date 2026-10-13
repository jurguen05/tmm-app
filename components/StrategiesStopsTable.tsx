'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PaginationControls from './PaginationControls'
import { ConsolidatedStrategyStop, Trade } from '../types'
import { updateTradeField } from '../services/queries'
import { supabase } from '../lib/supabase'

interface TableProps {
  datos: ConsolidatedStrategyStop[];
  cargando: boolean;
  missingTrades?: Trade[];
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

export default function StrategiesStopsTable({ datos, cargando, missingTrades }: TableProps) {
  const router = useRouter()
  const [missingList, setMissingList] = useState<Trade[]>(missingTrades || [])
  const [filtros, setFiltros] = useState({ trade_code: '', symbol: '', strategy: '' })
  const [paginaActual, setPaginaActual] = useState(1)
  const [elementosPorPagina, setElementosPorPagina] = useState(25)
  const [showRulesModal, setShowRulesModal] = useState(false)

  // Sincronizar missingList si cambian las props
  const [prevMissing, setPrevMissing] = useState(missingTrades)
  if (prevMissing !== missingTrades) {
    setPrevMissing(missingTrades)
    setMissingList(missingTrades || [])
  }

  const handleCloseMissingTrade = async (tradeCode: number) => {
    if (!confirm(`Are you sure you want to mark trade #${tradeCode} as Closed?`)) return
    try {
      await updateTradeField(supabase, tradeCode, 'status', 'Closed')
      setMissingList(prev => prev.filter(t => t.trade_code !== tradeCode))
      router.refresh()
    } catch (err: any) {
      alert('Error updating trade: ' + err.message)
    }
  }

  // Extraer lista de estrategias únicas existentes en los datos
  const uniqueStrategies = useMemo(() => {
    const set = new Set<string>();
    datos.forEach(d => {
      if (d.strategy && d.strategy !== 'S/D' && d.strategy !== '-') {
        set.add(d.strategy);
      }
    });
    return Array.from(set).sort();
  }, [datos]);

  const datosFiltrados = useMemo(() => {
    return datos.filter(d => {
      const matchCode = !filtros.trade_code.trim() || 
        (d.trade_code && d.trade_code.toString().toLowerCase().includes(filtros.trade_code.toLowerCase().trim()));
      const matchSymbol = !filtros.symbol.trim() || 
        (d.symbol && d.symbol.toLowerCase().includes(filtros.symbol.toLowerCase().trim()));
      const matchStrategy = !filtros.strategy.trim() || 
        (d.strategy && d.strategy.toLowerCase() === filtros.strategy.toLowerCase());
      return matchCode && matchSymbol && matchStrategy;
    });
  }, [datos, filtros])

  const hayFiltrosActivos = Boolean(filtros.trade_code || filtros.symbol || filtros.strategy);

  const totalPaginas = Math.max(1, Math.ceil(datosFiltrados.length / elementosPorPagina))
  const paginaValida = Math.min(Math.max(1, paginaActual), totalPaginas)

  // Paginación
  const indiceInicio = (paginaValida - 1) * elementosPorPagina
  const datosPaginados = useMemo(() => {
    return datosFiltrados.slice(indiceInicio, indiceInicio + elementosPorPagina)
  }, [datosFiltrados, indiceInicio, elementosPorPagina])

  if (cargando) {
    return <div className="text-center p-8 text-gray-500">Crossing data and calculating stop metrics...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Aviso de Review por Ausencia en Position Statement (Opción 2) */}
      {missingList.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg shadow-sm border border-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-amber-900">
                  Position Review ({missingList.length} open {missingList.length === 1 ? 'trade' : 'trades'} not in today's Position Statement)
                </h3>
              </div>
              <p className="text-xs text-amber-700 mt-1">
                The following trade(s) are recorded as <strong>Open</strong> in trade history, but do not appear in the latest Position Statement. They might have been closed, or affected by a corporate action (merger, acquisition, spin-off, ticker change):
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {missingList.map((tr) => (
                  <div key={tr.id} className="bg-white border border-amber-300 rounded-md px-3 py-1.5 text-xs flex items-center gap-3 shadow-xs">
                    <div>
                      <span className="font-bold text-gray-900">{tr.symbol}</span>
                      <span className="text-gray-500 ml-1.5">(Code: {tr.trade_code})</span>
                      <span className="text-indigo-600 ml-2 font-medium">{tr.strategies?.name || 'S/D'}</span>
                    </div>
                    <button
                      onClick={() => handleCloseMissingTrade(tr.trade_code)}
                      className="px-2.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-semibold border border-amber-300 cursor-pointer transition-colors text-xs"
                      title="Click to confirm and mark this trade as Closed"
                    >
                      Mark as Closed
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {(!datos || datos.length === 0) ? (
        <div className="bg-white p-8 rounded-lg shadow border border-gray-200 text-center text-gray-500">
          No active positions to analyze.
        </div>
      ) : (
        <>
          {/* Barra de Filtro y Acciones */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
            <input
              type="text"
              placeholder="e.g. 42"
              value={filtros.trade_code}
              onChange={(e) => {
                setFiltros(prev => ({ ...prev, trade_code: e.target.value }));
                setPaginaActual(1);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-28"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Symbol</label>
            <input
              type="text"
              placeholder="e.g. AAPL"
              value={filtros.symbol}
              onChange={(e) => {
                setFiltros(prev => ({ ...prev, symbol: e.target.value }));
                setPaginaActual(1);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-32"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Strategy</label>
            <select
              value={filtros.strategy}
              onChange={(e) => {
                setFiltros(prev => ({ ...prev, strategy: e.target.value }));
                setPaginaActual(1);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white min-w-[140px]"
            >
              <option value="">All</option>
              {uniqueStrategies.map(strat => (
                <option key={strat} value={strat}>{strat}</option>
              ))}
            </select>
          </div>

          {hayFiltrosActivos && (
            <button
              onClick={() => {
                setFiltros({ trade_code: '', symbol: '', strategy: '' });
                setPaginaActual(1);
              }}
              className="text-xs text-gray-500 hover:text-indigo-600 underline py-2 cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowRulesModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
          >
            <span>ℹ️</span> Strategy Stop Rules
          </button>
          <div className="text-xs text-gray-500 font-medium">
            {datosFiltrados.length} {datosFiltrados.length === 1 ? 'position' : 'positions'}
          </div>
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
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Stock Entry Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Last</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Stop</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rentabilidad</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {datosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No positions match the applied filters.
                  </td>
                </tr>
              ) : (
                datosPaginados.map((fila) => {
                  const isReview = fila.needsReview || fila.stop === 'Review';
                  return (
                    <tr 
                      key={fila.id} 
                      className={`transition-colors ${
                        isReview 
                          ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{fila.trade_code}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{fila.symbol}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-semibold">
                          {fila.strategy}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{formatoMoneda(fila.entryPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{formatoMoneda(fila.lastPrice)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {isReview ? (
                          <span 
                            title="No quote found in MK-TOS. Please upload the latest MK-TOS file."
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300"
                          >
                            Review
                          </span>
                        ) : typeof fila.stop === 'number' ? (
                          <span className="font-semibold text-gray-900">{formatoMoneda(fila.stop)}</span>
                        ) : (
                          <span className="text-gray-400 italic">{fila.stop}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${fila.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatoPorcentaje(fila.rentabilidad)}
                      </td>
                    </tr>
                  );
                })
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
      </>
      )}

      {/* Modal de Explicación de Reglas de Stops */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-2xl w-full p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Strategy Stop Calculation Rules</h3>
                <p className="text-xs text-gray-500 mt-0.5">Reference guide for all stop loss and trailing stop calculations</p>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-semibold leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Tech Trader Card */}
              <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-blue-900">Tech Trader</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">Active</span>
                </div>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p>
                    <strong>1. Protective Stop:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">Entry Price × 0.90</code> (Piso defensivo inicial al 90% del precio de compra).
                  </p>
                  <p>
                    <strong>2. Trailing Stop:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">180-Day EMA</code> (MovAvgExponential extraído de la cotización más reciente en MK-TOS).
                  </p>
                  <p>
                    <strong>3. Final Stop:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">MAX(Protective Stop, Trailing Stop)</code>.
                  </p>
                  <p className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 font-medium">
                    ⚠️ <strong>Falta de Cotización en MK-TOS:</strong> Si el símbolo no cuenta con cotización en MK-TOS, la posición se marca en <span className="bg-amber-200 px-1 py-0.5 rounded text-amber-900 font-bold">amarillo</span> con el estado <span className="font-bold">Review</span> para alertar la necesidad de cargar el archivo Quote correspondiente.
                  </p>
                </div>
              </div>

              {/* Informative Note for Upcoming Strategies */}
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500">
                <p className="font-semibold text-gray-700 mb-1">Upcoming Strategies:</p>
                <p>The rules for Hedge, 100-day-High, 20%-Flipper, BBO, New Yearly Highs, MACD, Weekend Trader, and Trend Pilot will appear here as we integrate them.</p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-4 py-2 bg-gray-800 text-white text-xs font-semibold rounded-md hover:bg-gray-900 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}