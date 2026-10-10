'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { subirArchivoOriginal } from '../lib/storage'

// 1. AVISAMOS QUE ACEPTA ESTA FUNCIÓN COMO PROP
interface UploadProps {
  onDatosActualizados?: () => void;
}

export default function UploadTransactionsCsv({ onDatosActualizados }: UploadProps) {
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)

  // ... (toda tu función normalizeNumber y procesarFecha quedan igual) ...
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando(true);
    setMensaje('Verificando archivo...');

    const { data: archivoExistente } = await supabase
      .from('file_uploads')
      .select('id')
      .eq('file_name', file.name)
      .eq('module', 'transactions')
      .maybeSingle();

    if (archivoExistente) {
      setMensaje(`⚠️ El archivo "${file.name}" ya fue subido anteriormente. Si querés volver a procesarlo, eliminalo primero desde el Historial.`);
      setCargando(false);
      e.target.value = '';
      return;
    }

    setMensaje('Procesando datos...');

    const matchAccount = file.name.match(/([A-Z]{3}\d{3})/);
    const accountId = matchAccount ? matchAccount[1] : 'DESCONOCIDO';

    const reader = new FileReader();
    reader.onload = (event) => {
      let csvText = event.target?.result as string;
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
              stock_entry_price: instrument === 'Stock' ? normalizeNumber(row['Price']) : null
            });
          }

          if (filasProcesadas.length > 0) {
            setMensaje('Guardando en la bóveda de Storage...');
            const uploadResult = await subirArchivoOriginal(file, accountId);
            
            if (!uploadResult.exito) {
              setMensaje(`⚠️ Error al guardar el archivo físico: ${uploadResult.error}`);
              setCargando(false);
              return;
            }

            setMensaje('Registrando historial...');
            const { data: fileRecord, error: fileRecordError } = await supabase
              .from('file_uploads')
              .insert({
                file_name: file.name,
                module: 'transactions',
                storage_path: `Transactions/${accountId}/${file.name}`
              })
              .select('id')
              .single();

            if (fileRecordError) {
              setMensaje(`⚠️ Error al registrar el archivo: ${fileRecordError.message}`);
              setCargando(false);
              return;
            }

            const filasConArchivo = filasProcesadas.map(f => ({
              ...f,
              file_upload_id: fileRecord.id
            }));

            const { error: insertError } = await supabase
              .from('transactions')
              .insert(filasConArchivo);
            
            if (insertError) {
              setMensaje('⚠️ Error al guardar transacciones: ' + insertError.message);
            } else {
              setMensaje(`✅ ¡Éxito! Archivo guardado y ${filasProcesadas.length} transacciones procesadas.`);
              e.target.value = '';
              // 2. ACÁ LLAMAMOS A LA FUNCIÓN PARA QUE ACTUALICE LA TABLA SOLA
              if (onDatosActualizados) {
                onDatosActualizados();
              }
            }
          } else {
            setMensaje('No se encontraron datos válidos en el CSV.');
          }
          setCargando(false);
        }
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Importar Transacciones (CSV)</h2>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload}
        disabled={cargando}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 cursor-pointer"
      />
      {mensaje && (
        <p className={`mt-4 text-sm font-medium p-3 rounded-md ${mensaje.includes('⚠️') ? 'bg-orange-50 text-orange-800 border border-orange-200' : mensaje.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
          {mensaje}
        </p>
      )}
    </div>
  )
}