'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import StrategiesStopsTable from '../../components/StrategiesStopsTable'

export default function DashboardPage() {
  const [datosCruzados, setDatosCruzados] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  const cargarPanelControl = async () => {
    setCargando(true)

    try {
      // 1. Traer Posiciones vigentes
      const { data: positions } = await supabase.from('positions').select('*')
      if (!positions || positions.length === 0) {
        setDatosCruzados([])
        setCargando(false)
        return
      }

      // 2. Traer Transacciones (solo las que coinciden con los unique_key de nuestras posiciones)
      const uniqueKeys = positions.map(p => p.unique_key)
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .in('unique_key', uniqueKeys)

      // 3. Traer MK-TOS (solo los activos)
      const { data: mktos } = await supabase
        .from('mk_tos_quotes')
        .select(`*, file_uploads!inner(is_archived)`)
        .eq('file_uploads.is_archived', false)

      // 4. EL CRUCE DE DATOS (El Cerebro)
      const consolidado = positions.map((pos) => {
        // Filtramos las transacciones de este código
        const txsDelCodigo = transactions?.filter(t => t.unique_key === pos.unique_key) || []

        // A. Buscar el trade_code
        const trade_code = txsDelCodigo.length > 0 ? txsDelCodigo[0].trade_code : '-'

        // B. Buscar Strategy (última con status "Open")
        const txsOpen = txsDelCodigo.filter(t => t.status === 'Open' || t.status === 'open')
        const txsOpenOrdenadas = txsOpen.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const strategy = txsOpenOrdenadas.length > 0 ? txsOpenOrdenadas[0].strategy : 'S/D'

        // C. Buscar Entry Price (primera compra, fechas de menor a mayor)
        const txsOrdenadasFechas = [...txsDelCodigo].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const entryPrice = txsOrdenadasFechas.length > 0 ? txsOrdenadasFechas[0].stock_entry_price : 0

        // D. Buscar Last Price (en MK-TOS por Symbol)
        const quotesDelSymbol = mktos?.filter(m => m.symbol === pos.symbol) || []
        const quotesOrdenadas = quotesDelSymbol.sort((a, b) => new Date(b.quote_date).getTime() - new Date(a.quote_date).getTime())
        const lastPrice = quotesOrdenadas.length > 0 ? quotesOrdenadas[0].last_price : 0

        // E. Calcular Rentabilidad: (Last / Entry Price) - 1
        let rentabilidad = 0
        if (entryPrice > 0 && lastPrice > 0) {
          rentabilidad = (lastPrice / entryPrice) - 1
        }

        return {
          id: pos.id,
          trade_code: trade_code,
          symbol: pos.symbol,
          strategy: strategy,
          entryPrice: entryPrice,
          lastPrice: lastPrice,
          stop: '-', // MAQUETA: A completar cuando veamos las reglas
          rentabilidad: rentabilidad
        }
      })

      // === NUEVO: ORDENAMOS LA LISTA ALFABÉTICAMENTE POR SYMBOL ===
      consolidado.sort((a, b) => a.symbol.localeCompare(b.symbol))

      setDatosCruzados(consolidado)

    } catch (error) {
      console.error("Error cruzando datos:", error)
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarPanelControl()
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Revisión diaria: Posiciones activas, stops y rentabilidad.
        </p>
      </div>

      {/* Renderizamos la tabla consolidada en el Dashboard */}
      <StrategiesStopsTable datos={datosCruzados} cargando={cargando} />
    </div>
  )
}