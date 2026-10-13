'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { processMkTosUpload } from '../services/fileUploadService'

export default function UploadMkTosCsv() {
  const router = useRouter()
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargando(true);
    setMensaje('Processing quote file...');

    try {
      const result = await processMkTosUpload(file, supabase);

      if (result.success) {
        setMensaje(`✅ ${result.message}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        router.refresh();
      } else {
        setMensaje(`⚠️ ${result.message}`);
      }
    } catch (err: any) {
      setMensaje(`⚠️ Unexpected error: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-800">MK-TOS (CSV)</h2>
      
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