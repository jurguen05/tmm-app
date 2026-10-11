'use client'

import { useEffect, useState } from 'react'
import { Position } from '../../../types'
import { getPositions } from '../../../services/queries'
import UploadPositionsCsv from '../../../components/UploadPositionsCsv'
import PositionsTable from '../../../components/PositionsTable'
import HistorialArchivosPositions from '../../../components/HistorialArchivosPositions'

export default function PositionsPage() {
  const [posiciones, setPosiciones] = useState<Position[]>([])
  const [cargando, setCargando] = useState(true)
  
  // GATILLO: Estado para forzar la recarga del historial
  const [refreshHistorial, setRefreshHistorial] = useState(0)

  const recargarDatos = async () => {
    setCargando(true)
    try {
      const data = await getPositions()
      setPosiciones(data || [])
      
      // Cada vez que se recargan los datos, movemos el gatillo para que el historial se entere
      setRefreshHistorial(prev => prev + 1)
      
    } catch (error: any) {
      console.error("Error cargando posiciones:", error.message)
    }
    setCargando(false)
  }

  useEffect(() => {
    recargarDatos()
  }, [])

  // Obtenemos la fecha del Statement desde la primera posición (si existe)
  const statementDate = posiciones.length > 0 ? posiciones[0].statement_date : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Positions</h1>
          {statementDate && (
            <p className="text-lg text-gray-600 mt-2">
              Positions Date: <span className="text-xl font-bold text-indigo-600">{statementDate}</span>
            </p>
          )}
        </div>
      </div>

      {/* GRILLA: Upload y Historial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <UploadPositionsCsv onDatosActualizados={recargarDatos} />
        
        <HistorialArchivosPositions 
          onDatosActualizados={recargarDatos} 
          refreshTrigger={refreshHistorial} 
        />
      </div>

      {/* TABLA PRINCIPAL */}
      {cargando ? (
        <p className="text-gray-500">Cargando posiciones...</p>
      ) : (
        <PositionsTable posiciones={posiciones} />
      )}
    </div>
  )
}