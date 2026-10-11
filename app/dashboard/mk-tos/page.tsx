'use client'

import { useState } from 'react'
import UploadMkTosCsv from '../../../components/UploadMkTosCsv'
import HistorialArchivosMkTos from '../../../components/HistorialArchivosMkTos'

export default function MkTosPage() {
  // GATILLO: Estado para forzar la recarga del historial
  const [refreshHistorial, setRefreshHistorial] = useState(0)

  // Esta función se dispara cuando el Upload termina de subir un archivo con éxito,
  // o cuando el Historial elimina uno.
  const recargarDatos = () => {
    // Movemos el gatillo para que el Historial se entere y se recargue
    setRefreshHistorial(prev => prev + 1)
    
    // NOTA: Acá a futuro también llamaremos a la base de datos 
    // para traer todas las cotizaciones activas y pasárselas a la tabla.
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">MK-TOS</h1>
        <p className="text-gray-600 mt-2">
          Gestión de archivos Quote con indicadores técnicos.
        </p>
      </div>

      {/* GRILLA: Upload y Historial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <UploadMkTosCsv onDatosActualizados={recargarDatos} />
        
        <HistorialArchivosMkTos 
          onDatosActualizados={recargarDatos} 
          refreshTrigger={refreshHistorial} 
        />
      </div>

      {/* TABLA PRINCIPAL (Próximo paso) */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center text-gray-500">
        Acá irá la gran tabla unificada mostrando los datos de todos los archivos activos.
      </div>
    </div>
  )
}