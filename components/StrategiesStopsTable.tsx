'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PaginationControls from './PaginationControls'
import { ConsolidatedStrategyStop, Trade } from '../types'
import { updateTradeField, updateTransactionsByTradeCode, closeTradeWithExitMetrics } from '../services/queries'
import { supabase } from '../lib/supabase'
import { formatearFecha } from '../lib/formatters'

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
  const [filtros, setFiltros] = useState({ trade_code: '', symbol: '', strategy: '', stopAlert: '' })
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
      const match = datos.find(d => Number(d.trade_code) === tradeCode);
      const exitStop = match && typeof match.stop === 'number' ? match.stop : null;
      const exitPrice = match?.lastPrice || null;
      const exitSignal = match?.signal ?? null;

      await closeTradeWithExitMetrics(supabase, tradeCode, {
        exit_stop: exitStop,
        exit_price: exitPrice,
        exit_signal: exitSignal,
        closed_date: new Date().toISOString().substring(0, 10)
      });
      await updateTransactionsByTradeCode(supabase, tradeCode, 'position_status', 'Closed').catch(() => {})
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

  const redStopsCount = useMemo(() => {
    return datos.filter(d => Boolean(d.isStopRed)).length;
  }, [datos]);

  const reviewStopsCount = useMemo(() => {
    return datos.filter(d => Boolean(d.needsReview || d.stop === 'Review' || d.stop === '-')).length;
  }, [datos]);

  const datosFiltrados = useMemo(() => {
    return datos.filter(d => {
      const matchCode = !filtros.trade_code.trim() || 
        (d.trade_code && d.trade_code.toString().toLowerCase().includes(filtros.trade_code.toLowerCase().trim()));
      const matchSymbol = !filtros.symbol.trim() || 
        (d.symbol && d.symbol.toLowerCase().includes(filtros.symbol.toLowerCase().trim()));
      const matchStrategy = !filtros.strategy.trim() || 
        (d.strategy && d.strategy.toLowerCase() === filtros.strategy.toLowerCase());
      const matchStopAlert = !filtros.stopAlert || 
        (filtros.stopAlert === 'red' && Boolean(d.isStopRed)) ||
        (filtros.stopAlert === 'review' && Boolean(d.needsReview || d.stop === 'Review' || d.stop === '-'));
      return matchCode && matchSymbol && matchStrategy && matchStopAlert;
    });
  }, [datos, filtros])

  const hayFiltrosActivos = Boolean(filtros.trade_code || filtros.symbol || filtros.strategy || filtros.stopAlert);

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

          <button
            type="button"
            onClick={() => {
              setFiltros(prev => ({ ...prev, stopAlert: prev.stopAlert === 'red' ? '' : 'red' }));
              setPaginaActual(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold border transition-all cursor-pointer ${
              filtros.stopAlert === 'red'
                ? 'bg-red-600 text-white border-red-700 shadow-sm ring-2 ring-red-300'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
            }`}
            title="Filter rows where the Stop cell is red"
          >
            <span>🚨</span>
            <span>{filtros.stopAlert === 'red' ? 'Showing Red Stops' : `Red Stops (${redStopsCount})`}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltros(prev => ({ ...prev, stopAlert: prev.stopAlert === 'review' ? '' : 'review' }));
              setPaginaActual(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold border transition-all cursor-pointer ${
              filtros.stopAlert === 'review'
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200'
            }`}
            title="Filter rows needing Review (missing quotes in MK-TOS)"
          >
            <span>⚠️</span>
            <span>{filtros.stopAlert === 'review' ? 'Showing Review' : `Review (${reviewStopsCount})`}</span>
          </button>

          {hayFiltrosActivos && (
            <button
              onClick={() => {
                setFiltros({ trade_code: '', symbol: '', strategy: '', stopAlert: '' });
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
                <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Code</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Symbol</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Strategy</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Entry Price</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Signal</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Last</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Max Price</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Max Date</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Stop</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rentabilidad</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {datosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    {filtros.stopAlert === 'red'
                      ? 'No positions currently have triggered red stops.'
                      : filtros.stopAlert === 'review'
                      ? 'No positions currently require review.'
                      : 'No positions match the applied filters.'}
                  </td>
                </tr>
              ) : (
                datosPaginados.map((fila) => {
                  const isReview = Boolean(fila.needsReview || fila.stop === 'Review' || fila.stop === '-');
                  return (
                    <tr 
                      key={fila.id} 
                      className={`transition-colors ${
                        isReview 
                          ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 text-center font-medium text-gray-600 whitespace-nowrap">{fila.trade_code}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-900 whitespace-nowrap">{fila.symbol}</td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-semibold">
                          {fila.strategy}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{formatoMoneda(fila.entryPrice)}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap text-sm">
                        {fila.signal !== null && fila.signal !== undefined && fila.signal >= 3 ? (
                          <span 
                            title={`Signal: ${fila.signal} (≥ 3: Stop triggered at Last price)`}
                            className="inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300"
                          >
                            {fila.signal}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{formatoMoneda(fila.lastPrice)}</td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                        {fila.max_stock_price ? formatoMoneda(fila.max_stock_price) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 whitespace-nowrap text-xs">
                        {fila.max_stock_price_date ? formatearFecha(fila.max_stock_price_date) : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap transition-colors ${
                        isReview ? 'bg-amber-100/80 border-y border-amber-300' : ''
                      }`}>
                        {isReview ? (
                          <span 
                            title={fila.reviewReason || "Requires review: unconfigured strategy, missing quote, or missing metric in MK-TOS."}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-200 text-amber-900 border border-amber-400 shadow-xs"
                          >
                            <span>⚠️</span> Review
                          </span>
                        ) : fila.isStopRed ? (
                          <span 
                            title="Stop Alert: Triggered / Active"
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300"
                          >
                            {typeof fila.stop === 'number' ? formatoMoneda(fila.stop) : fila.stop}
                          </span>
                        ) : typeof fila.stop === 'number' ? (
                          <span className="font-semibold text-gray-900">
                            {formatoMoneda(fila.stop)}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">
                            {fila.stop}
                          </span>
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
                    <strong>1. Protective Stop:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">Entry Price × 0.90</code> (Initial defensive floor at 90% of stock entry price).
                  </p>
                  <p>
                    <strong>2. Trailing Stop:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">180-Day EMA</code> (MovAvgExponential extracted from the latest MK-TOS quote).
                  </p>
                  <p>
                    <strong>3. Final Stop:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">MAX(Protective Stop, Trailing Stop)</code>.
                  </p>
                  <p>
                    🔴 <strong>Red Badge Alert:</strong> When <code className="bg-white px-1 rounded border border-blue-200 text-blue-800">Last Price &lt; Stop</code>, the Stop value is displayed with a <span className="bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded font-bold">Red Badge</span>.
                  </p>
                  <p className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 font-medium">
                    ⚠️ <strong>Missing MK-TOS Quote:</strong> If the symbol has no quote in MK-TOS, it is flagged in <span className="bg-amber-200 px-1 py-0.5 rounded text-amber-900 font-bold">yellow</span> with status <span className="font-bold">Review</span>.
                  </p>
                </div>
              </div>

              {/* Trend Pilot Card */}
              <div className="p-4 rounded-lg border border-cyan-200 bg-cyan-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-cyan-900">Trend Pilot</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 font-semibold">Active</span>
                </div>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p>
                    <strong>Signal Column:</strong> Extracted from <code className="bg-white px-1.5 py-0.5 rounded border border-cyan-200 text-cyan-800">TrendPilot_STOP</code> in the latest MK-TOS quote. Displays the number when <code className="bg-white px-1 rounded border border-cyan-200 text-cyan-800">≥ 3</code>; otherwise displays <code className="bg-white px-1 rounded">-</code>.
                  </p>
                  <p>
                    <strong>Stop Value:</strong> Always displays the current <code className="bg-white px-1.5 py-0.5 rounded border border-cyan-200 text-cyan-800">Last Price</code>.
                  </p>
                  <p>
                    🔴 <strong>Red Badge Alert (Signal ≥ 3):</strong> When the indicator value reaches <code className="bg-white px-1.5 py-0.5 rounded border border-cyan-200 text-cyan-800">≥ 3</code>, the Stop value is displayed with a <span className="bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded font-bold">Red Badge</span>.
                  </p>
                </div>
              </div>

              {/* MAC Card */}
              <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-indigo-900">MAC (MACD)</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">Active</span>
                </div>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p>
                    <strong>Signal Column:</strong> Extracted from <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-800">MAC_STOP</code> in the latest MK-TOS quote. Displays the number when <code className="bg-white px-1 rounded border border-indigo-200 text-indigo-800">≥ 3</code>; otherwise displays <code className="bg-white px-1 rounded">-</code>.
                  </p>
                  <p>
                    <strong>Stop Value:</strong> Always displays the current <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-800">Last Price</code>.
                  </p>
                  <p>
                    🔴 <strong>Red Badge Alert (Signal ≥ 3):</strong> When the indicator value reaches <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-800">≥ 3</code>, the Stop value is displayed with a <span className="bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded font-bold">Red Badge</span>.
                  </p>
                </div>
              </div>

              {/* 20% Flipper Card */}
              <div className="p-4 rounded-lg border border-purple-200 bg-purple-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-purple-900">20% Flipper</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">Active</span>
                </div>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p>
                    <strong>1. Max Stock Price & Date:</strong> Tracks the highest <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-800">High</code> price recorded across all historical quotes and active sessions from <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-800">first_buy_date</code> to present.
                  </p>
                  <p>
                    <strong>2. Trailing Stop:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-800">Max Stock Price × 0.80</code> (-20% trailing floor).
                  </p>
                  <p>
                    🔴 <strong>Red Badge Alert:</strong> When <code className="bg-white px-1 rounded border border-purple-200 text-purple-800">Last Price &lt; Stop</code>, the Stop value is displayed with a <span className="bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded font-bold">Red Badge</span>.
                  </p>
                  <p className="text-purple-800 bg-purple-50 p-2 rounded border border-purple-200 font-medium">
                    📌 <strong>Peak Reference:</strong> Persisted in the <code className="bg-white px-1 rounded">trades</code> master table so historical MK-TOS files outside the active trade window can later be archived safely.
                  </p>
                </div>
              </div>

              {/* Weekend Trader Card */}
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-900">Weekend Trader</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Active</span>
                </div>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p>
                    <strong>1. Peak High & Date:</strong> Tracks the highest <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800">High</code> price recorded on weekly close sessions (Fridays, or Thursdays if Friday was a market holiday) from <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800">first_buy_date</code> to present.
                  </p>
                  <p>
                    <strong>2. General Market Filter (SPY vs SMA 10W):</strong> Evaluates the latest weekly close for the S&P 500 ETF (<code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800">SPY</code>):
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-1 text-emerald-950">
                    <li><strong>Bullish Market (<code className="bg-white px-1 rounded">SPY &gt; SMA 10W</code>):</strong> Stop = <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800">High × 0.60</code> (-40% trailing stop).</li>
                    <li><strong>Bearish Market (<code className="bg-white px-1 rounded">SPY ≤ SMA 10W</code>):</strong> Stop = <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800">High × 0.90</code> (-10% defensive stop).</li>
                  </ul>
                  <p className="text-emerald-900 bg-emerald-100/70 p-2 rounded border border-emerald-300 font-medium">
                    📌 <strong>Permanent Trade Flag:</strong> All Weekend Trader trades bought before <strong>24/07/2026</strong> have the defensive flag active by definition (<code className="bg-white px-1 rounded">weekend_trader_flag = true</code>, stop at <code className="bg-white px-1 rounded">High × 0.90</code>). For trades bought after, once they experience a bearish weekly close (<code className="bg-white px-1 rounded">SPY ≤ SMA 10W</code>), they are permanently flagged and stay at 0.90.
                  </p>
                  <p>
                    🔴 <strong>Red Badge Alert:</strong> When <code className="bg-white px-1 rounded border border-emerald-200 text-emerald-800">Last Price &lt; Stop</code>, the Stop value is displayed with a <span className="bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded font-bold">Red Badge</span>.
                  </p>
                  <p className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 font-medium">
                    ⚠️ <strong>Review Alert:</strong> If <code className="bg-white px-1 rounded">SPY</code> is missing in MK-TOS or the position has no Friday peak price, it is flagged as <span className="font-bold">Review</span>.
                  </p>
                </div>
              </div>

              {/* New Yearly Highs Card */}
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-amber-900">New Yearly Highs</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">Active</span>
                </div>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p>
                    <strong>Ratchet Trailing Stop:</strong> Tracks the highest <code className="bg-white px-1.5 py-0.5 rounded border border-amber-200 text-amber-800">52-Week Low (52Low)</code> recorded from <code className="bg-white px-1.5 py-0.5 rounded border border-amber-200 text-amber-800">first_buy_date</code> to present. Strictly increasing (trailing) trinquete: if 52Low rises, the stop rises; if it drops or fluctuates, the previous highest stop is preserved and never steps down.
                  </p>
                  <p>
                    🔴 <strong>Red Badge Alert:</strong> When <code className="bg-white px-1 rounded border border-amber-200 text-amber-800">Last Price &lt; Stop</code>, the Stop value is displayed with a <span className="bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded font-bold">Red Badge</span>.
                  </p>
                  <p className="text-amber-900 bg-amber-100/70 p-2 rounded border border-amber-300 font-medium">
                    📌 <strong>Peak Reference:</strong> Persisted in <code className="bg-white px-1 rounded">trades.ratchet_stop</code> so historical MK-TOS files can be safely archived without losing the ratcheted floor.
                  </p>
                  <p className="text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 font-medium">
                    ⚠️ <strong>Missing MK-TOS Quote:</strong> If the symbol has no quote or 52Low in MK-TOS, it is flagged as <span className="font-bold">Review</span>.
                  </p>
                </div>
              </div>

              {/* 100-day-High Card */}
              <div className="p-4 rounded-lg border border-teal-200 bg-teal-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-teal-900">100-day-High</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">Active</span>
                </div>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p>
                    <strong>Ratchet Trailing Stop:</strong> Tracks the highest <code className="bg-white px-1.5 py-0.5 rounded border border-teal-200 text-teal-800">100-day Low (100-day-Low)</code> recorded from <code className="bg-white px-1.5 py-0.5 rounded border border-teal-200 text-teal-800">first_buy_date</code> to present. Strictly increasing (trailing) trinquete: if 100-day-Low rises, the stop rises; if it drops or fluctuates, the previous highest stop is preserved and never steps down.
                  </p>
                  <p>
                    🔴 <strong>Red Badge Alert (Sell Signal):</strong> When <code className="bg-white px-1 rounded border border-teal-200 text-teal-800">Last Price &lt; Stop</code>, the Stop value is displayed with a <span className="bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded font-bold">Red Badge</span>.
                  </p>
                  <p className="text-teal-900 bg-teal-100/70 p-2 rounded border border-teal-300 font-medium">
                    📌 <strong>Peak Reference:</strong> Persisted in <code className="bg-white px-1 rounded">trades.ratchet_stop</code> so historical MK-TOS files can be safely archived without losing the ratcheted floor.
                  </p>
                  <p className="text-teal-800 bg-teal-50 p-2 rounded border border-teal-200 font-medium">
                    ⚠️ <strong>Missing MK-TOS Quote:</strong> If the symbol has no quote or 100-day-Low in MK-TOS, it is flagged as <span className="font-bold">Review</span>.
                  </p>
                </div>
              </div>

              {/* BBO (Bollinger Bands) Card */}
              <div className="p-4 rounded-lg border border-sky-200 bg-sky-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-sky-900">BBO (Bollinger Bands)</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold">Active</span>
                </div>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p>
                    <strong>Stop Value:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-sky-200 text-sky-800">Lower Band (BBO)</code> (Extracted from the BBO column in MK-TOS, representing the lower band configured at 1 standard deviation).
                  </p>
                  <p>
                    🔴 <strong>Red Badge Alert (Exit Point):</strong> When <code className="bg-white px-1 rounded border border-sky-200 text-sky-800">Last Price &lt; Stop</code> (stock closes below the lower band), the Stop value is displayed with a <span className="bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded font-bold">Red Badge</span>.
                  </p>
                  <p className="text-sky-800 bg-sky-50 p-2 rounded border border-sky-200 font-medium">
                    ⚠️ <strong>Missing MK-TOS Quote:</strong> If the symbol has no quote or BBO in MK-TOS, it is flagged as <span className="font-bold">Review</span>.
                  </p>
                </div>
              </div>

              {/* Hedge Card */}
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">Hedge</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">Active</span>
                </div>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p>
                    <strong>Stop Value:</strong> Always displays the current <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-800">Last Price</code>.
                  </p>
                  <p>
                    🛡️ <strong>No Stop Rule:</strong> Hedge positions do not have an automated exit rule or stop trigger. The Stop cell remains informational and will not trigger a red badge alert.
                  </p>
                </div>
              </div>

              {/* Informative Note for Unconfigured Strategies & Review Status */}
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/70 text-xs text-amber-900 space-y-1">
                <p className="font-semibold text-amber-950 mb-0.5">⚠️ Review Status (Unconfigured Strategies or Missing Metrics):</p>
                <p>Any position whose Stop cannot be calculated or would otherwise show <code className="bg-white px-1 rounded border border-amber-300">-</code> (including any new unconfigured strategy, missing MK-TOS quotes, or missing peak prices) is automatically flagged as <span className="font-bold">Review</span> with a yellow warning highlight.</p>
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