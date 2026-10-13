'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { FileUpload } from '../types'
import { getFileUploads } from '../services/queries'
import { deleteUploadedFileCompletely } from '../services/fileUploadService'

export default function HistorialArchivosMkTos() {
  const router = useRouter()
  const [archivos, setArchivos] = useState<FileUpload[]>([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const cargarArchivos = async () => {
    setCargando(true)
    try {
      const data = await getFileUploads(supabase, 'mk-tos', 3)
      setArchivos(data)
    } catch (err: any) {
      console.error('Error fetching MK-TOS uploads:', err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarArchivos()
  }, [])

  const handleEliminar = async (archivo: FileUpload) => {
    if (!window.confirm(`Are you sure you want to delete "${archivo.file_name}"?\n\nThis will permanently delete the file and ALL its quotes from the database.`)) {
      return
    }

    setMensaje(`Deleting "${archivo.file_name}"...`)
    try {
      await deleteUploadedFileCompletely(archivo, supabase)
      setMensaje(`✅ File deleted successfully.`)
      cargarArchivos()
      router.refresh()
    } catch (err: any) {
      setMensaje(`⚠️ Error deleting file: ${err.message}`)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">File History</h2>
        <button onClick={cargarArchivos} className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
          ↻ Refresh
        </button>
      </div>

      {mensaje && (
        <p className={`mb-4 text-sm font-medium p-3 rounded-md ${mensaje.includes('⚠️') ? 'bg-orange-50 text-orange-800' : 'bg-blue-50 text-blue-800'}`}>
          {mensaje}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-gray-500">Loading history...</p>
      ) : archivos.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No files imported yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                        Archived
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-center">
                    {new Date(archivo.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-right space-x-3">
                    <button 
                      onClick={() => handleEliminar(archivo)}
                      className="text-red-600 hover:text-red-900 transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {!cargando && archivos.length === 3 && (
        <div className="text-xs text-gray-400 mt-3 text-right italic">
          Showing 3 most recent uploads.
        </div>
      )}
    </div>
  )
}