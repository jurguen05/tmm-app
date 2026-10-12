'use client'

import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { eliminarArchivoPositions, descargarArchivoPositions } from '../lib/storage'
import { procesarFilasPosiciones } from '../lib/positionsParser'
import { parsearFechaTOS } from '../lib/formatters'

interface FileUpload {
  id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}

export default function HistorialArchivosPositions() {
  const router = useRouter()
  const [archivos, setArchivos] = useState<FileUpload[]>([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const cargarArchivos = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('module', 'positions') 
      .order('created_at', { ascending: false })
      .limit(5)

    if (!error && data) {
      setArchivos(data)
    }
    setCargando(false)
  }

  // Se ejecuta solo al montar. (Ver advertencia arquitectónica arriba)
  useEffect(() => {
    cargarArchivos()
  }, [])

  const handleEliminar = async (id: string, storagePath: string, fileName: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${fileName}"?\n\nESTO BORRARÁ LA FOTO DE POSICIONES ASOCIADA.`)) {
      return;
    }

    setMensaje(`Eliminando "${fileName}"...`)

    const resStorage = await eliminarArchivoPositions(storagePath);
    if (!resStorage.exito) {
      setMensaje(`⚠️ Error al borrar de Storage: ${resStorage.error}`);
    }

    const { error } = await supabase.from('file_uploads').delete().eq('id', id);

    if (error) {
      setMensaje(`⚠️ Error al borrar registro: ${error.message}`);
    } else {
      setMensaje(`✅ Archivo eliminado correctamente.`);
      cargarArchivos(); // Actualiza el historial local
      router.refresh(); // Forzamos la actualización del servidor (tabla)
    }
  }

  const handleReprocesar = async (archivo: FileUpload) => {
    if (!window.confirm(`¿Querés restaurar "${archivo.file_name}"?\n\nEsto borrará la foto actual y cargará las posiciones de este archivo.`)) {
      return;
    }

    setMensaje(`Descargando archivo...`)
    const resDescarga = await descargarArchivoPositions(archivo.storage_path);
    if (!resDescarga.exito || !resDescarga.data) {
      setMensaje(`⚠️ Error al descargar: ${resDescarga.error}`);
      return;
    }

    setMensaje(`Procesando el Position Statement...`);
    const csvText = await resDescarga.data.text();
    const lineas = csvText.split('\n');

    const statementDate = parsearFechaTOS(lineas[0]) || parsearFechaTOS(archivo.file_name) || new Date().toISOString().split('T')[0];

    let headerIndex = 0;
    for (let i = 0; i < lineas.length; i++) {
      if (lineas[i].startsWith('Instrument,Qty')) {
        headerIndex = i;
        break;
      }
    }

    const lineasUtiles = lineas.slice(headerIndex);
    const lineasLimpias = lineasUtiles.map(linea => {
      let l = linea.trim();
      if (l.startsWith('"') && l.endsWith('"')) {
        l = l.substring(1, l.length - 1).replace(/""/g, '"');
      }
      return l;
    });
    const csvLimpio = lineasLimpias.join('\n');

    Papa.parse(csvLimpio, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        
        const filasProcesadas = procesarFilasPosiciones(results.data, statementDate, archivo.id);

        if (filasProcesadas.length > 0) {
          setMensaje('Borrando la foto anterior...');
          await supabase.from('positions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

          setMensaje('Restaurando posiciones...');
          const { error: insertError } = await supabase.from('positions').insert(filasProcesadas);
          
          if (insertError) {
            setMensaje('⚠️ Error al guardar: ' + insertError.message);
          } else {
            setMensaje(`✅ ¡Éxito! Se restauraron ${filasProcesadas.length} posiciones.`);
            router.refresh(); // Forzamos la actualización del servidor (tabla)
          }
        } else {
          setMensaje('No se encontraron datos válidos en el CSV al reprocesar.');
        }
      }
    });
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">File History</h2>
        <button onClick={cargarArchivos} className="text-sm text-indigo-600 hover:text-indigo-800">
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
        <p className="text-sm text-gray-500 italic">No hay archivos importados recientemente.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Archivo</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Fecha de subida</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {archivos.map((archivo) => (
                <tr key={archivo.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {archivo.file_name.replace(/.*(PositionStatement_?\d*).*/, '$1.csv')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-center">
                    {new Date(archivo.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-right space-x-3">
                    <button 
                      onClick={() => handleReprocesar(archivo)}
                      className="text-indigo-600 hover:text-indigo-900 transition-colors"
                    >
                      Reprocesar
                    </button>
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
    </div>
  )
}