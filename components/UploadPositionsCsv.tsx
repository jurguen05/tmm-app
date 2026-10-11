'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { subirArchivoPositions } from '../lib/storage'
import { procesarFilasPosiciones } from '../lib/positionsParser' // <-- IMPORTAMOS TU NUEVO HELPER

interface UploadProps {
  onDatosActualizados?: () => void;
}

export default function UploadPositionsCsv({ onDatosActualizados }: UploadProps) {
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando(true);
    setMensaje('Verificando archivo...');

    const { data: archivoExistente } = await supabase
      .from('file_uploads')
      .select('id')
      .eq('file_name', file.name)
      .eq('module', 'positions')
      .maybeSingle();

    if (archivoExistente) {
      setMensaje(`⚠️ El archivo "${file.name}" ya fue subido. Eliminalo del historial si querés subirlo de nuevo.`);
      setCargando(false);
      e.target.value = '';
      return;
    }

    setMensaje('Leyendo y limpiando el Position Statement...');

    const matchAccount = file.name.match(/([A-Z]{3}\d{3})/);
    const accountId = matchAccount ? matchAccount[1] : 'DESCONOCIDO';

    const reader = new FileReader();
    reader.onload = async (event) => {
      let csvText = event.target?.result as string;
      const lineas = csvText.split('\n');

      let statementDate = new Date().toISOString().split('T')[0]; 
      if (lineas[0] && lineas[0].includes(' on ')) {
        const dateMatch = lineas[0].match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (dateMatch) {
          const parts = dateMatch[1].split('/');
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          statementDate = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }

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
          
          // MAGIA: Llamamos a tu helper y le pasamos los datos y la fecha
          const filasProcesadas = procesarFilasPosiciones(results.data, statementDate);

          if (filasProcesadas.length > 0) {
            setMensaje('Guardando archivo físico...');
            
            const uploadResult = await subirArchivoPositions(file, accountId);
            if (!uploadResult.exito) {
              setMensaje(`⚠️ Error al guardar en Storage: ${uploadResult.error}`);
              setCargando(false);
              return;
            }

            setMensaje('Registrando en el historial...');
            const { data: fileRecord, error: fileRecordError } = await supabase
              .from('file_uploads')
              .insert({
                file_name: file.name,
                module: 'positions',
                storage_path: `${accountId}/${file.name}` 
              })
              .select('id')
              .single();

            if (fileRecordError) {
              setMensaje(`⚠️ Error en historial: ${fileRecordError.message}`);
              setCargando(false);
              return;
            }

            setMensaje('Borrando la "foto" anterior...');
            await supabase.from('positions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

            // Le inyectamos el ID del archivo a todas las filas antes de guardarlas
            const filasConArchivo = filasProcesadas.map(f => ({ ...f, file_upload_id: fileRecord.id }));

            setMensaje('Insertando posiciones actuales...');
            const { error: insertError } = await supabase.from('positions').insert(filasConArchivo);
            
            if (insertError) {
              setMensaje('⚠️ Error al insertar posiciones: ' + insertError.message);
            } else {
              setMensaje(`✅ ¡Éxito! Foto actualizada con ${filasProcesadas.length} posiciones.`);
              e.target.value = '';
              if (onDatosActualizados) onDatosActualizados();
            }
          } else {
            setMensaje('No se encontraron posiciones válidas en el CSV.');
          }
          setCargando(false);
        }
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Position Statement (CVS)</h2>
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