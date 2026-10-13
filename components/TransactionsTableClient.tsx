'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { updateTransactionField, deleteTransactions, updateTradeField, updateTransactionsByTradeCode } from '../services/queries'
import { Transaction, Strategy } from '../types'
import TransactionsTable from './TransactionsTable'
import PaginationControls from './PaginationControls'

interface Props {
  initialTransactions: Transaction[]
  estrategias: Strategy[]
}

export default function TransactionsTableClient({ initialTransactions, estrategias }: Props) {
  const router = useRouter()
  
  // Guardamos las transacciones en estado local para poder borrarlas/editarlas visualmente al instante
  const [transacciones, setTransacciones] = useState<Transaction[]>(initialTransactions)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filtros, setFiltros] = useState({ trade_code: '', symbol: '', strategy: '', status: '' })

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const [elementosPorPagina, setElementosPorPagina] = useState(25)

  // Sincronizar transacciones si initialTransactions cambia (sin efecto en cascada)
  const [prevInitial, setPrevInitial] = useState(initialTransactions)
  if (prevInitial !== initialTransactions) {
    setPrevInitial(initialTransactions)
    setTransacciones(initialTransactions)
  }

  const actualizarTransaccion = async (id: string, campo: string, valor: any) => {
    const tx = transacciones.find(t => t.id === id)
    if (!tx) return;

    const codeNum = tx.trade_code ? Number(tx.trade_code) : null;
    const est = campo === 'strategy_id' ? estrategias.find(e => e.id === valor) : null;

    // Optimistic UI update: Si tiene trade_code, actualizar todas las filas de ese trade en pantalla
    setTransacciones(prev => prev.map(t => {
      const matchTrade = codeNum && t.trade_code && Number(t.trade_code) === codeNum;
      if (matchTrade) {
        if (campo === 'strategy_id') {
          return {
            ...t,
            strategy_id: valor,
            strategies: est ? { name: est.name } : null,
            strategy: est ? est.name : null
          };
        }
        if (campo === 'position_status') {
          return { ...t, position_status: valor };
        }
        if (campo === 'stock_entry_price') {
          return { ...t, stock_entry_price: valor };
        }
      }
      return t.id === id ? { ...t, [campo]: valor } : t;
    }));

    try {
      if (codeNum && !isNaN(codeNum) && codeNum > 0) {
        // 1. Actualizar la tabla maestra trades
        if (campo === 'strategy_id') {
          await updateTradeField(supabase, codeNum, 'strategy_id', valor);
        } else if (campo === 'stock_entry_price') {
          await updateTradeField(supabase, codeNum, 'stock_entry_price', valor);
        } else if (campo === 'position_status') {
          await updateTradeField(supabase, codeNum, 'status', valor);
        }

        // 2. Actualizar las transacciones hijas para consistencia
        await updateTransactionsByTradeCode(supabase, codeNum, campo, valor).catch(() => {});
      } else {
        await updateTransactionField(supabase, id, campo, valor);
      }
      router.refresh();
    } catch (error: any) {
      alert('Hubo un error al guardar el cambio: ' + error.message);
    }
  }

  const borrarSeleccionadas = async () => {
    if (!confirm(`¿Estás seguro de que querés borrar ${selectedIds.length} transacción/es?`)) return
    try {
      await deleteTransactions(supabase, selectedIds)
      
      setTransacciones(prev => prev.filter(t => !selectedIds.includes(t.id)))
      setSelectedIds([])
      router.refresh()
    } catch (error: any) {
      alert('Error al borrar: ' + error.message)
    }
  }

  const toggleSeleccion = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id])
  }

  // Lógica de filtrado
  const txsFiltradas = useMemo(() => {
    return transacciones.filter(t => {
      const matchCodigo = filtros.trade_code === '' || (t.trade_code && t.trade_code.toString().includes(filtros.trade_code));
      const matchSymbol = filtros.symbol === '' || (t.symbol && t.symbol.toLowerCase().includes(filtros.symbol.toLowerCase()));
      
      const strategyName = t.strategies?.name || '';
      const matchStrategy = filtros.strategy === '' || strategyName === filtros.strategy;
      
      const matchStatus = filtros.status === '' || (t.position_status && t.position_status.toLowerCase() === filtros.status.toLowerCase());
      return matchCodigo && matchSymbol && matchStrategy && matchStatus;
    })
  }, [transacciones, filtros])

  // Ajustar página actual calculada de forma pura
  const totalPaginas = Math.max(1, Math.ceil(txsFiltradas.length / elementosPorPagina))
  const paginaValida = Math.min(Math.max(1, paginaActual), totalPaginas)

  // Resetear a página 1 cuando cambia algún filtro
  const handleFiltroChange = (nuevoFiltro: typeof filtros) => {
    setFiltros(nuevoFiltro)
    setPaginaActual(1)
  }

  const hayFiltrosActivos = filtros.trade_code !== '' || filtros.symbol !== '' || filtros.strategy !== '' || filtros.status !== ''

  // Transacciones paginadas
  const indiceInicio = (paginaValida - 1) * elementosPorPagina
  const txsPaginadas = useMemo(() => {
    return txsFiltradas.slice(indiceInicio, indiceInicio + elementosPorPagina)
  }, [txsFiltradas, indiceInicio, elementosPorPagina])

  const toggleSeleccionarTodas = () => {
    const todosEnPaginaSeleccionados = txsPaginadas.length > 0 && txsPaginadas.every(t => selectedIds.includes(t.id))
    if (todosEnPaginaSeleccionados) {
      setSelectedIds(prev => prev.filter(id => !txsPaginadas.some(t => t.id === id)))
    } else {
      const idsDePagina = txsPaginadas.map(t => t.id)
      setSelectedIds(prev => Array.from(new Set([...prev, ...idsDePagina])))
    }
  }

  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200 flex flex-wrap items-end gap-4 justify-between">
        <div className="flex flex-wrap gap-4 flex-1 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
            <input 
              type="text" 
              placeholder="e.g. 42" 
              value={filtros.trade_code} 
              onChange={(e) => handleFiltroChange({...filtros, trade_code: e.target.value})} 
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-28" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Symbol</label>
            <input 
              type="text" 
              placeholder="e.g. AAPL" 
              value={filtros.symbol} 
              onChange={(e) => handleFiltroChange({...filtros, symbol: e.target.value})} 
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-32" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Strategy</label>
            <select 
              value={filtros.strategy} 
              onChange={(e) => handleFiltroChange({...filtros, strategy: e.target.value})} 
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white w-40"
            >
              <option value="">All</option>
              {estrategias.map(est => (
                <option key={est.id} value={est.name}>{est.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select 
              value={filtros.status} 
              onChange={(e) => handleFiltroChange({...filtros, status: e.target.value})} 
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {hayFiltrosActivos && (
            <button
              onClick={() => handleFiltroChange({ trade_code: '', symbol: '', strategy: '', status: '' })}
              className="text-xs text-gray-500 hover:text-indigo-600 underline py-2 cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
        
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedIds([])}
              className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
            >
              Deselect
            </button>
            <button onClick={borrarSeleccionadas} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-semibold hover:bg-red-100 transition-colors cursor-pointer">
              Delete selected ({selectedIds.length})
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <TransactionsTable 
          transacciones={txsPaginadas} 
          estrategias={estrategias} 
          selectedIds={selectedIds} 
          onToggleSeleccion={toggleSeleccion} 
          onToggleSeleccionarTodas={toggleSeleccionarTodas} 
          onActualizarTransaccion={actualizarTransaccion} 
        />

        {txsFiltradas.length > 0 && (
          <PaginationControls
            currentPage={paginaValida}
            totalItems={txsFiltradas.length}
            pageSize={elementosPorPagina}
            pageSizeOptions={[15, 25, 50, 100]}
            onPageChange={setPaginaActual}
            onPageSizeChange={(newSize) => {
              setElementosPorPagina(newSize)
              setPaginaActual(1)
            }}
            itemName="transacciones"
          />
        )}
      </div>
    </>
  )
}