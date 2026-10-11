'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

import { Transaction, Strategy } from '../../../types'
import { 
  getUserProfile, 
  getTransactions, 
  getActiveStrategies, 
  updateTransactionField, 
  deleteTransactions 
} from '../../../services/queries'

import UploadTransactionsCsv from '../../../components/uploadtransactionscsv'
import HistorialArchivosTransactions from '../../../components/HistorialArchivosTransactions'
import TransactionsTable from '../../../components/TransactionsTable'

export default function TransactionsPage() {
  const [transacciones, setTransacciones] = useState<Transaction[]>([])
  const [estrategias, setEstrategias] = useState<Strategy[]>([])
  const [cargando, setCargando] = useState(true)
  const [rol, setRol] = useState<number | null>(null)
  
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // 1. ACTUALIZADO: Estado inicial del filtro
  const [filtros, setFiltros] = useState({ trade_code: '', symbol: '', strategy: '', status: '' })

  const recargarDatos = async () => {
    setCargando(true)
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      const perfil = await getUserProfile(session.user.id)
      if (perfil) {
        setRol(perfil.role_id)
        if (perfil.role_id === 1) {
          const txs = await getTransactions()
          setTransacciones(txs)
          const strats = await getActiveStrategies()
          setEstrategias(strats)
        }
      }
    }
    setCargando(false)
  }

  useEffect(() => {
    recargarDatos()
  }, [])

  const actualizarTransaccion = async (id: string, campo: string, valor: any) => {
    setTransacciones((prev) => prev.map(t => t.id === id ? { ...t, [campo]: valor } : t))
    try {
      await updateTransactionField(id, campo, valor)
    } catch (error: any) {
      alert('Hubo un error al guardar el cambio: ' + error.message)
    }
  }

  const borrarSeleccionadas = async () => {
    if (!confirm(`¿Estás seguro de que querés borrar ${selectedIds.length} transacción/es?`)) return
    try {
      await deleteTransactions(selectedIds)
      setTransacciones(prev => prev.filter(t => !selectedIds.includes(t.id)))
      setSelectedIds([])
    } catch (error: any) {
      alert('Error al borrar: ' + error.message)
    }
  }

  const toggleSeleccion = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id])
  }

  const txsFiltradas = transacciones.filter(t => {
    // 2. ACTUALIZADO: Lógica de filtrado leyendo t.trade_code
    const matchCodigo = filtros.trade_code === '' || (t.trade_code && t.trade_code.toString().includes(filtros.trade_code));
    const matchSymbol = filtros.symbol === '' || (t.symbol && t.symbol.toLowerCase().includes(filtros.symbol.toLowerCase()));
    const matchStrategy = filtros.strategy === '' || (t.strategy && t.strategy === filtros.strategy);
    const matchStatus = filtros.status === '' || (t.position_status && t.position_status.toLowerCase() === filtros.status.toLowerCase());
    return matchCodigo && matchSymbol && matchStrategy && matchStatus;
  })

  const toggleSeleccionarTodas = () => {
    if (selectedIds.length === txsFiltradas.length) {
      setSelectedIds([]) 
    } else {
      setSelectedIds(txsFiltradas.map(t => t.id)) 
    }
  }

  if (cargando && transacciones.length === 0) return <div className="flex h-full items-center justify-center py-20">Cargando transacciones...</div>

  if (rol === 2) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg text-center border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">¡Bienvenido a TMM!</h1>
          <p className="text-gray-600">
            Tu perfil ha sido validado correctamente. Las transacciones son gestionadas exclusivamente por nuestros operadores.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-[95%] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Transactions</h1>
          {cargando && <span className="text-sm text-indigo-500 animate-pulse">Sincronizando...</span>}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <UploadTransactionsCsv onDatosActualizados={recargarDatos} />
          <HistorialArchivosTransactions onDatosActualizados={recargarDatos} />
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200 flex flex-wrap items-end gap-4 justify-between">
          <div className="flex flex-wrap gap-4 flex-1">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Buscar Código</label>
              {/* 3. ACTUALIZADO: Input leyendo y escribiendo en filtros.trade_code */}
              <input type="text" placeholder="Ej: 42" value={filtros.trade_code} onChange={(e) => setFiltros({...filtros, trade_code: e.target.value})} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-28" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Buscar Símbolo</label>
              <input type="text" placeholder="Ej: AAPL" value={filtros.symbol} onChange={(e) => setFiltros({...filtros, symbol: e.target.value})} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-32" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estrategia</label>
              <select value={filtros.strategy} onChange={(e) => setFiltros({...filtros, strategy: e.target.value})} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white w-40">
                <option value="">Todas</option>
                {estrategias.map(est => (
                  <option key={est.id} value={est.name}>{est.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
              <select value={filtros.status} onChange={(e) => setFiltros({...filtros, status: e.target.value})} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 bg-white">
                <option value="">Todos</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          
          {selectedIds.length > 0 && (
            <button onClick={borrarSeleccionadas} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-semibold hover:bg-red-100 transition-colors">
              Borrar {selectedIds.length} seleccionada/s
            </button>
          )}
        </div>
        
        <TransactionsTable 
          transacciones={txsFiltradas} 
          estrategias={estrategias} 
          selectedIds={selectedIds} 
          onToggleSeleccion={toggleSeleccion} 
          onToggleSeleccionarTodas={toggleSeleccionarTodas} 
          onActualizarTransaccion={actualizarTransaccion} 
        />
      </div>
    </div>
  )
}