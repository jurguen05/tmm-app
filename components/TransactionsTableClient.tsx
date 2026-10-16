'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import {
  updateTransactionField,
  updateTradeField,
  updateTransactionsByTradeCode,
  getFilteredTransactions
} from '../services/queries'
import { Transaction, Strategy } from '../types'
import TransactionsTable, { TradeTransactionGroup } from './TransactionsTable'
import PaginationControls from './PaginationControls'

interface Props {
  initialTransactions: Transaction[]
  estrategias: Strategy[]
}

export default function TransactionsTableClient({ initialTransactions, estrategias }: Props) {
  const router = useRouter()

  const [transacciones, setTransacciones] = useState<Transaction[]>(initialTransactions)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [filtros, setFiltros] = useState({ trade_code: '', symbol: '', strategy: '', status: '' })
  const [isSearching, setIsSearching] = useState(false)

  // Paginación por grupos de Trade
  const [paginaActual, setPaginaActual] = useState(1)
  const [elementosPorPagina, setElementosPorPagina] = useState(25)

  const hayFiltrosActivos =
    filtros.trade_code !== '' ||
    filtros.symbol !== '' ||
    filtros.strategy !== '' ||
    filtros.status !== ''

  // Sincronizar transacciones si initialTransactions cambia (sin sobreescribir si hay filtro activo)
  const [prevInitial, setPrevInitial] = useState(initialTransactions)
  if (prevInitial !== initialTransactions) {
    setPrevInitial(initialTransactions)
    if (!hayFiltrosActivos) {
      setTransacciones(initialTransactions)
    }
  }

  // Búsqueda en el servidor cuando se activa un filtro (trae todas las transacciones históricas del filtro)
  useEffect(() => {
    if (!hayFiltrosActivos) {
      setTransacciones(initialTransactions)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const resultados = await getFilteredTransactions(supabase, filtros)
        setTransacciones(resultados)
      } catch (err: any) {
        console.error('Error searching filtered transactions:', err)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [filtros, hayFiltrosActivos, initialTransactions])

  // Re-consultar automáticamente cuando se sube o elimina un archivo en Historial
  useEffect(() => {
    const handleTransactionsChanged = async () => {
      if (hayFiltrosActivos) {
        setIsSearching(true)
        try {
          const res = await getFilteredTransactions(supabase, filtros)
          setTransacciones(res)
        } finally {
          setIsSearching(false)
        }
      } else {
        router.refresh()
      }
    }
    window.addEventListener('transactions-changed', handleTransactionsChanged)
    return () => window.removeEventListener('transactions-changed', handleTransactionsChanged)
  }, [hayFiltrosActivos, filtros, router])

  // Filtrar transacciones y agruparlas por trade_code (Master-Detail)
  const txsFiltradas = useMemo(() => {
    return transacciones.filter((t) => {
      const matchCodigo =
        filtros.trade_code === '' ||
        (t.trade_code && t.trade_code.toString().includes(filtros.trade_code))
      const searchSym = filtros.symbol.toLowerCase()
      const matchSymbol =
        filtros.symbol === '' ||
        (t.symbol && t.symbol.toLowerCase().includes(searchSym)) ||
        (t.unique_key && t.unique_key.toLowerCase().includes(searchSym))

      const strategyName =
        t.strategies?.name ||
        t.strategy ||
        (t.strategy_id ? estrategias.find((e) => e.id === t.strategy_id)?.name : '') ||
        ''
      const matchStrategy =
        filtros.strategy === '' || strategyName.toLowerCase() === filtros.strategy.toLowerCase()

      const matchStatus =
        filtros.status === '' ||
        (t.position_status && t.position_status.toLowerCase() === filtros.status.toLowerCase())
      return matchCodigo && matchSymbol && matchStrategy && matchStatus
    })
  }, [transacciones, filtros, estrategias])

  const gruposFiltrados: TradeTransactionGroup[] = useMemo(() => {
    const map = new Map<string, TradeTransactionGroup>()

    for (const tx of txsFiltradas) {
      const codeNum =
        tx.trade_code !== null && tx.trade_code !== undefined && !isNaN(Number(tx.trade_code)) && Number(tx.trade_code) > 0
          ? Number(tx.trade_code)
          : null
      const groupKey = codeNum ? `trade-${codeNum}` : `orphan-${tx.id}`
      const masterTrade = tx.trade

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          trade_code: codeNum,
          symbol: masterTrade?.symbol || tx.symbol || 'UNKNOWN',
          unique_key: masterTrade?.unique_key || tx.unique_key || tx.symbol || 'UNKNOWN',
          instrument: (masterTrade?.instrument || tx.instrument || 'Stock') as 'Stock' | 'Option',
          strategy_id: masterTrade?.strategy_id ?? tx.strategy_id ?? null,
          stock_entry_price: masterTrade?.stock_entry_price ?? tx.stock_entry_price ?? null,
          status: (masterTrade?.status || tx.position_status || 'Open') as 'Open' | 'Closed',
          first_buy_date: masterTrade?.first_buy_date || tx.date || null,
          latest_date: tx.date,
          net_cash_flow: Number(tx.amount) || 0,
          transactions: [tx]
        })
      } else {
        const g = map.get(groupKey)!
        g.transactions.push(tx)
        g.net_cash_flow += Number(tx.amount) || 0
        if (tx.date > g.latest_date) {
          g.latest_date = tx.date
        }
        if (!g.first_buy_date || tx.date < g.first_buy_date) {
          g.first_buy_date = tx.date
        }
      }
    }

    // Ordenar transacciones internas cronológicamente (más reciente arriba o orden de ejecución)
    const groups = Array.from(map.values())
    for (const g of groups) {
      g.transactions.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date)
        return (b.created_at || '').localeCompare(a.created_at || '')
      })
    }

    // Ordenar grupos por fecha más reciente y código descendente
    groups.sort((a, b) => {
      if (a.latest_date !== b.latest_date) return b.latest_date.localeCompare(a.latest_date)
      return (b.trade_code || 0) - (a.trade_code || 0)
    })

    return groups
  }, [txsFiltradas])

  // Paginación sobre grupos de Trade
  const totalPaginas = Math.max(1, Math.ceil(gruposFiltrados.length / elementosPorPagina))
  const paginaValida = Math.min(Math.max(1, paginaActual), totalPaginas)

  const handleFiltroChange = (nuevoFiltro: typeof filtros) => {
    setFiltros(nuevoFiltro)
    setPaginaActual(1)
  }

  const indiceInicio = (paginaValida - 1) * elementosPorPagina
  const gruposPaginados = useMemo(() => {
    return gruposFiltrados.slice(indiceInicio, indiceInicio + elementosPorPagina)
  }, [gruposFiltrados, indiceInicio, elementosPorPagina])

  const handleToggleExpand = (groupKey: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  const handleExpandAllPage = () => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      for (const g of gruposPaginados) {
        next.add(g.groupKey)
      }
      return next
    })
  }

  const handleCollapseAll = () => {
    setExpandedKeys(new Set())
  }

  const actualizarTradeGroup = async (
    group: TradeTransactionGroup,
    campo: 'strategy_id' | 'stock_entry_price',
    valor: any
  ) => {
    const codeNum = group.trade_code
    const est = campo === 'strategy_id' ? estrategias.find((e) => e.id === valor) : null

    // Optimistic UI update en todas las transacciones del grupo
    setTransacciones((prev) =>
      prev.map((t) => {
        const matchTrade =
          codeNum !== null
            ? t.trade_code && Number(t.trade_code) === codeNum
            : group.transactions.some((gt) => gt.id === t.id)

        if (!matchTrade) return t

        const updatedTrade = t.trade ? { ...t.trade, [campo]: valor } : t.trade
        if (campo === 'strategy_id') {
          return {
            ...t,
            strategy_id: valor,
            strategies: est ? { name: est.name } : null,
            strategy: est ? est.name : null,
            trade: updatedTrade
              ? { ...updatedTrade, strategies: est ? { name: est.name } : null }
              : updatedTrade
          }
        }
        return {
          ...t,
          stock_entry_price: valor,
          trade: updatedTrade
        }
      })
    )

    try {
      if (codeNum && !isNaN(codeNum) && codeNum > 0) {
        await updateTradeField(supabase, codeNum, campo, valor)
        await updateTransactionsByTradeCode(supabase, codeNum, campo, valor).catch(() => {})
      } else if (group.transactions.length > 0) {
        await updateTransactionField(supabase, group.transactions[0].id, campo, valor)
      }
      router.refresh()
    } catch (error: any) {
      alert('Error saving trade change: ' + error.message)
    }
  }

  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200 flex flex-wrap items-end gap-4 justify-between">
        <div className="flex flex-wrap gap-4 flex-1 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trade Code</label>
            <input
              type="text"
              placeholder="e.g. 42"
              value={filtros.trade_code}
              onChange={(e) => handleFiltroChange({ ...filtros, trade_code: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-28"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Symbol / Unique Key
            </label>
            <input
              type="text"
              placeholder="e.g. AAPL"
              value={filtros.symbol}
              onChange={(e) => handleFiltroChange({ ...filtros, symbol: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-36"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Strategy</label>
            <select
              value={filtros.strategy}
              onChange={(e) => handleFiltroChange({ ...filtros, strategy: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white w-44"
            >
              <option value="">All</option>
              {estrategias.map((est) => (
                <option key={est.id} value={est.name}>
                  {est.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={filtros.status}
              onChange={(e) => handleFiltroChange({ ...filtros, status: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {hayFiltrosActivos ? (
            <div className="flex items-center gap-2 py-1">
              <button
                onClick={() =>
                  handleFiltroChange({ trade_code: '', symbol: '', strategy: '', status: '' })
                }
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline cursor-pointer"
              >
                Clear filters
              </button>
              <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full font-medium">
                {isSearching
                  ? 'Searching database...'
                  : `${gruposFiltrados.length} trades (${txsFiltradas.length} fills)`}
              </span>
            </div>
          ) : (
            <div className="py-1">
              <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full">
                Showing {gruposFiltrados.length} recent trades ({txsFiltradas.length} fills)
              </span>
            </div>
          )}
        </div>

        {/* Expand / Collapse Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExpandAllPage}
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-700 transition cursor-pointer"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-700 transition cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <TransactionsTable
          grupos={gruposPaginados}
          estrategias={estrategias}
          expandedKeys={expandedKeys}
          onToggleExpand={handleToggleExpand}
          onActualizarTradeGroup={actualizarTradeGroup}
        />

        {gruposFiltrados.length > 0 && (
          <PaginationControls
            currentPage={paginaValida}
            totalItems={gruposFiltrados.length}
            pageSize={elementosPorPagina}
            pageSizeOptions={[15, 25, 50, 100]}
            onPageChange={setPaginaActual}
            onPageSizeChange={(newSize) => {
              setElementosPorPagina(newSize)
              setPaginaActual(1)
            }}
            itemName="trades"
          />
        )}
      </div>
    </>
  )
}