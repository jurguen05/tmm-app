'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { updateTransactionField, deleteTransactions } from '../services/queries'
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
    // Optimistic UI update
    setTransacciones(prev => prev.map(t => t.id === id ? { ...t, [campo]: valor } : t))
    try {
      await updateTransactionField(supabase, id, campo, valor)
      router.refresh() // Avisar al server que los datos cambiaron
    } catch (error: any) {
      alert('Hubo un error al guardar el cambio: ' + error.message)
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar Código</label>
            <input 
              type="text" 
              placeholder="Ej: 42" 
              value={filtros.trade_code} 
              onChange={(e) => handleFiltroChange({...filtros, trade_code: e.target.value})} 
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-28" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar Símbolo</label>
            <input 
              type="text" 
              placeholder="Ej: AAPL" 
              value={filtros.symbol} 
              onChange={(e) => handleFiltroChange({...filtros, symbol: e.target.value})} 
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-32" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estrategia</label>
            <select 
              value={filtros.strategy} 
              onChange={(e) => handleFiltroChange({...filtros, strategy: e.target.value})} 
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white w-40"
            >
              <option value="">Todas</option>
              {estrategias.map(est => (
                <option key={est.id} value={est.name}>{est.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select 
              value={filtros.status} 
              onChange={(e) => handleFiltroChange({...filtros, status: e.target.value})} 
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="">Todos</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {hayFiltrosActivos && (
            <button
              onClick={() => handleFiltroChange({ trade_code: '', symbol: '', strategy: '', status: '' })}
              className="text-xs text-gray-500 hover:text-indigo-600 underline py-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedIds([])}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Deseleccionar
            </button>
            <button onClick={borrarSeleccionadas} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-semibold hover:bg-red-100 transition-colors">
              Borrar {selectedIds.length} seleccionada/s
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