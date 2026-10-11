'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { eliminarArchivoMkTos } from '../lib/storage'

interface FileUpload {
  id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
  is_archived: boolean;
}

interface HistorialProps {
  onDatosActualizados?: () => void;
  refreshTrigger?: number;
}

export default function HistorialArchivosMkTos({ onDatosActualizados, refreshTrigger }: HistorialProps) {
  const [archivos, setArchivos] = useState<FileUpload[]>([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const cargarArchivos = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('module', 'mk-tos')
      .order('created_at', { ascending: false })
      .limit(3) // <-- ACÁ LE DECIMOS QUE TRAIGA SOLO LOS 3 MÁS NUEVOS

    if (!error && data) {
      setArchivos(data)
    }
    setCargando(false)
  }

  // Escuchamos el gatillo para recargar cuando se sube uno nuevo
  useEffect(() => {
    cargarArchivos()
  }, [refreshTrigger])

  const handleEliminar = async (id: string, storagePath: string, fileName: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${fileName}"?\n\nEsto borrará permanentemente el archivo y TODAS sus cotizaciones asociadas de la base de datos.`)) {
      return;
    }

    setMensaje(`Eliminando "${fileName}"...`)

    // 1. Borramos físicamente del bucket Mk-tos
    const resStorage = await eliminarArchivoMkTos(storagePath);
    if (!resStorage.exito) {
      setMensaje(`⚠️ Error al borrar de Storage: ${resStorage.error}`);
    }

    // 2. Borramos el registro (y por 'cascade', se borran sus cotizaciones)
    const { error } = await supabase.from('file_uploads').delete().eq('id', id);

    if (error) {
      setMensaje(`⚠️ Error al borrar registro: ${error.message}`);
    } else {
      setMensaje(`✅ Archivo eliminado correctamente.`);
      cargarArchivos(); 
      if (onDatosActualizados) onDatosActualizados();
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">File history</h2>
        <button onClick={cargarArchivos} className="text-sm text-blue-600 hover:text-blue-800">
          ↻ Actualizar
        </button>
      </div>

      {mensaje && (
        <p className={`mb-4 text-sm font-medium p-3 rounded-md ${mensaje.includes('⚠️') ? 'bg-orange-50 text-orange-800' : 'bg-blue-50 text-blue-800'}`}>
          {mensaje}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando historial...</p>
      ) : archivos.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No hay archivos importados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Archivo</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Fecha de subida</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {archivos.map((archivo) => (
                <tr key={archivo.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {archivo.file_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {archivo.is_archived ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Archivado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Activo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-center">
                    {new Date(archivo.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-right space-x-3">
                    {/* El botón Archivar irá acá a futuro */}
                    <button 
                      onClick={() => handleEliminar(archivo.id, archivo.storage_path, archivo.file_name)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Mensaje sutil indicando que hay más historial oculto */}
      {!cargando && archivos.length === 3 && (
        <div className="text-xs text-gray-400 mt-3 text-right italic">
          Mostrando las 3 subidas más recientes.
        </div>
      )}
    </div>
  )
}