'use client'

import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { eliminarArchivoStorage, descargarArchivoStorage } from '../lib/storage'

interface FileUpload {
  id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}

// 1. AVISAMOS QUE ACEPTA ESTA FUNCIÓN COMO PROP
interface HistorialProps {
  onDatosActualizados?: () => void;
}

export default function HistorialArchivosTransactions({ onDatosActualizados }: HistorialProps) {
  const [archivos, setArchivos] = useState<FileUpload[]>([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const normalizeNumber = (value: string | undefined | null) => {
    if (!value) return 0;
    const cleanStr = value.toString().replace(/[^0-9.-]+/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  const procesarFecha = (rawDate: string) => {
    if (!rawDate) return null;
    const matches = rawDate.match(/\d{2}\/\d{2}\/\d{4}/g);
    if (!matches) return null;
    const finalDate = matches[matches.length - 1];
    const parts = finalDate.split('/');
    return `${parts[2]}-${parts[0]}-${parts[1]}`; 
  };

  const cargarArchivos = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('module', 'transactions')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!error && data) {
      setArchivos(data)
    }
    setCargando(false)
  }

  useEffect(() => {
    cargarArchivos()
  }, [])

  const handleEliminar = async (id: string, storagePath: string, fileName: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${fileName}"?\n\nESTO BORRARÁ TODAS LAS TRANSACCIONES ASOCIADAS A ESTE ARCHIVO. Esta acción no se puede deshacer.`)) {
      return;
    }

    setMensaje(`Eliminando "${fileName}"...`)

    const resStorage = await eliminarArchivoStorage(storagePath);
    if (!resStorage.exito) {
      setMensaje(`⚠️ Error al borrar de Storage: ${resStorage.error}`);
    }

    const { error } = await supabase.from('file_uploads').delete().eq('id', id);

    if (error) {
      setMensaje(`⚠️ Error al borrar registro: ${error.message}`);
    } else {
      setMensaje(`✅ Archivo eliminado correctamente.`);
      cargarArchivos(); 
      // 2. ACTUALIZAMOS LA TABLA PADRE
      if (onDatosActualizados) onDatosActualizados();
    }
  }

  const handleReprocesar = async (archivo: FileUpload) => {
    if (!window.confirm(`¿Querés reprocesar "${archivo.file_name}"?\n\nEsto borrará las transacciones actuales y las volverá a generar.`)) {
      return;
    }

    setMensaje(`Descargando archivo...`)
    const resDescarga = await descargarArchivoStorage(archivo.storage_path);
    if (!resDescarga.exito || !resDescarga.data) {
      setMensaje(`⚠️ Error al descargar: ${resDescarga.error}`);
      return;
    }

    setMensaje(`Procesando datos del CSV...`);
    const csvText = await resDescarga.data.text();
    const lineas = csvText.split('\n');
    const lineasLimpias = lineas.map(linea => {
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
        const filasProcesadas = [];
        const matchAccount = archivo.file_name.match(/([A-Z]{3}\d{3})/);
        const accountId = matchAccount ? matchAccount[1] : 'DESCONOCIDO';

        for (const row of results.data as any[]) {
          const symbolOriginal = row['Symbol'];
          if (!symbolOriginal) continue;

          let uniqueKey, symbol, instrument;
          const optionMatch = symbolOriginal.match(/^([A-Z]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+(\.\d+)?)\s+([CP])$/);

          if (optionMatch) {
            const ticker = optionMatch[1];
            const parts = optionMatch[2].split('/');
            const expiry = `${parts[1]}/${parts[0]}/${parts[2]}`;
            const strike = parseFloat(optionMatch[3]);
            const type = optionMatch[5];
            uniqueKey = `${ticker}-${expiry} ${strike} ${type}`;
            symbol = ticker;
            instrument = 'Option';
          } else {
            uniqueKey = symbolOriginal;
            symbol = symbolOriginal;
            instrument = 'Stock';
          }

          const realDate = procesarFecha(row['Date']);
          if (!realDate) continue;

          filasProcesadas.push({
            account_id: accountId,
            date: realDate,
            action: row['Action'],
            symbol: symbol,
            instrument: instrument,
            unique_key: uniqueKey,
            quantity: row['Quantity'] ? Math.abs(parseFloat(row['Quantity'].toString().replace(/[^0-9.-]+/g, ''))) : 0,
            price: normalizeNumber(row['Price']),
            fees: normalizeNumber(row['Fees & Comm']),
            amount: normalizeNumber(row['Amount']),
            position_status: 'Open', 
            strategy: null,
            stock_entry_price: instrument === 'Stock' ? normalizeNumber(row['Price']) : null,
            file_upload_id: archivo.id 
          });
        }

        if (filasProcesadas.length > 0) {
          setMensaje('Actualizando base de datos...');
          await supabase.from('transactions').delete().eq('file_upload_id', archivo.id);
          const { error: insertError } = await supabase.from('transactions').insert(filasProcesadas);
          
          if (insertError) {
            setMensaje('⚠️ Error al guardar: ' + insertError.message);
          } else {
            setMensaje(`✅ ¡Éxito! Se reprocesaron ${filasProcesadas.length} transacciones.`);
            // 3. ACTUALIZAMOS LA TABLA PADRE
            if (onDatosActualizados) onDatosActualizados();
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
        <h2 className="text-xl font-bold text-gray-800">File history</h2>
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
                    {archivo.file_name.replace(/.*(Transactions_\d+)-.*/, '$1.csv')}
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