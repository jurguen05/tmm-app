'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import UploadMkTosCsv from '../../../components/UploadMkTosCsv'
import HistorialArchivosMkTos from '../../../components/HistorialArchivosMkTos'
import MkTosTable from '../../../components/MkTosTable'

export default function MkTosPage() {
  const [refreshHistorial, setRefreshHistorial] = useState(0)
  const [quotes, setQuotes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  const recargarDatos = async () => {
    setCargando(true)
    // 1. Forzamos la actualización del historial visual
    setRefreshHistorial(prev => prev + 1)
    
    // 2. Buscamos todas las cotizaciones de archivos NO archivados
    const { data, error } = await supabase
      .from('mk_tos_quotes')
      .select(`
        *,
        file_uploads!inner(is_archived)
      `)
      .eq('file_uploads.is_archived', false)
      .order('symbol', { ascending: true })

    if (error) {
      console.error('Error cargando cotizaciones:', error.message)
    } else {
      setQuotes(data || [])
    }
    
    setCargando(false)
  }

  // Cargar la tabla al entrar a la página
  useEffect(() => {
    recargarDatos()
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">MK-TOS</h1>
        <p className="text-gray-600 mt-2">
          Gestión de archivos Quote con indicadores técnicos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <UploadMkTosCsv onDatosActualizados={recargarDatos} />
        
        <HistorialArchivosMkTos 
          onDatosActualizados={recargarDatos} 
          refreshTrigger={refreshHistorial} 
        />
      </div>

      {/* Renderizamos la Gran Tabla */}
      <MkTosTable quotes={quotes} cargando={cargando} />
    </div>
  )
}