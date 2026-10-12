'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { subirArchivoMkTos } from '../lib/storage'
import { procesarFilasMkTos } from '../lib/mkTosParser'
import { parsearFechaTOS } from '../lib/formatters'

export default function UploadMkTosCsv() {
  const router = useRouter()
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando(true);
    setMensaje('Verificando archivo...');

    const { data: archivoExistente } = await supabase
      .from('file_uploads')
      .select('id')
      .eq('file_name', file.name)
      .eq('module', 'mk-tos')
      .maybeSingle();

    if (archivoExistente) {
      setMensaje(`⚠️ El archivo "${file.name}" ya fue subido. Eliminalo del historial si querés subirlo de nuevo.`);
      setCargando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setMensaje('Leyendo y limpiando el archivo Quote...');

    const matchAccount = file.name.match(/([A-Z]{3}\d{3})/);
    const accountId = matchAccount ? matchAccount[1] : 'GENERAL';

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvText = event.target?.result as string;
      const lineas = csvText.split('\n');

      const quoteDate = parsearFechaTOS(lineas[0]) || parsearFechaTOS(file.name) || new Date().toISOString().split('T')[0];

      let headerIndex = 0;
      for (let i = 0; i < lineas.length; i++) {
        if (lineas[i].startsWith('Symbol,Description')) {
          headerIndex = i;
          break;
        }
      }

      const lineasUtiles = lineas.slice(headerIndex);
      const csvLimpio = lineasUtiles.join('\n');

      Papa.parse(csvLimpio, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          
          const filasProcesadas = procesarFilasMkTos(results.data, quoteDate);

          if (filasProcesadas.length > 0) {
            setMensaje('Guardando archivo físico en bucket Mk-tos...');
            
            const uploadResult = await subirArchivoMkTos(file, accountId);
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
                module: 'mk-tos',
                storage_path: `${accountId}/${file.name}` 
              })
              .select('id')
              .single();

            if (fileRecordError) {
              setMensaje(`⚠️ Error en historial: ${fileRecordError.message}`);
              setCargando(false);
              return;
            }

            const filasConArchivo = filasProcesadas.map(f => ({ ...f, file_upload_id: fileRecord.id }));

            setMensaje('Insertando cotizaciones...');
            const { error: insertError } = await supabase.from('mk_tos_quotes').insert(filasConArchivo);
            
            if (insertError) {
              setMensaje('⚠️ Error al insertar cotizaciones: ' + insertError.message);
            } else {
              setMensaje(`✅ ¡Éxito! Archivo procesado con ${filasProcesadas.length} símbolos.`);
              if (fileInputRef.current) fileInputRef.current.value = '';
              // FORZAMOS LA ACTUALIZACIÓN DEL SERVIDOR
              router.refresh();
            }
          } else {
            setMensaje('No se encontraron cotizaciones válidas en el CSV.');
          }
          setCargando(false);
        }
      });
    };
    reader.readAsText(file);
  };

  return (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-800">MK-TOS (CSV)</h2>
      
      {/* Este div envuelve el input y el mensaje, usando flex-1 para ocupar el espacio restante y justify-center para centrarse verticalmente */}
      <div className="flex-1 flex flex-col justify-center">
        <input 
          type="file" 
          accept=".csv" 
          ref={fileInputRef}
          onClick={() => setMensaje('')}
          onChange={handleFileUpload}
          disabled={cargando}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 cursor-pointer"
        />
        {mensaje && (
          <p className={`mt-4 text-sm font-medium p-3 rounded-md ${mensaje.includes('⚠️') ? 'bg-orange-50 text-orange-800 border border-orange-200' : mensaje.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
            {mensaje}
          </p>
        )}
      </div>
    </div>
  )
}