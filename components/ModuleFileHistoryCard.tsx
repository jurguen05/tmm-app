'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { FileUpload } from '../types'
import { getFileUploads } from '../services/queries'
import { deleteUploadedFileCompletely } from '../services/fileUploadService'

export interface ModuleFileHistoryCardProps {
  title: string
  moduleType: 'positions' | 'transactions' | 'mk-tos'
  initialLimit?: number
  allowPagination?: boolean
  processingMessage?: string
  emptyMessage?: string
  deleteConfirmMessage?: (fileName: string) => string
  renderFileName?: (archivo: FileUpload) => string
  onUpload: (file: File) => Promise<{ success: boolean; message: string; [key: string]: any }>
  onUploadSuccess?: (result: any) => void
  onReprocess?: (archivo: FileUpload) => Promise<{ success: boolean; message: string }>
  reprocessButtonLabel?: string
  reprocessConfirmMessage?: (fileName: string) => string
  onAfterDelete?: (archivo: FileUpload) => void
  children?: React.ReactNode
}

export function ModuleFileHistoryCard({
  title,
  moduleType,
  initialLimit = 3,
  allowPagination = false,
  processingMessage = 'Processing file...',
  emptyMessage = 'No files uploaded recently.',
  deleteConfirmMessage = (fileName) => `Are you sure you want to delete "${fileName}"?`,
  renderFileName,
  onUpload,
  onUploadSuccess,
  onReprocess,
  reprocessButtonLabel = 'Restore',
  reprocessConfirmMessage = (fileName) => `Do you want to restore "${fileName}"?`,
  onAfterDelete,
  children,
}: ModuleFileHistoryCardProps) {
  const router = useRouter()
  const [archivos, setArchivos] = useState<FileUpload[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [colapsado, setColapsado] = useState(true)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchLimit = allowPagination ? 50 : initialLimit

  const cargarArchivos = useCallback(async () => {
    setCargando(true)
    try {
      const data = await getFileUploads(supabase, moduleType, fetchLimit)
      setArchivos(data)
    } catch (err: any) {
      console.error(`Error fetching ${moduleType} uploads:`, err.message)
    } finally {
      setCargando(false)
    }
  }, [moduleType, fetchLimit])

  useEffect(() => {
    cargarArchivos()
  }, [cargarArchivos])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSubiendo(true)
    setMensaje(processingMessage)

    try {
      const result = await onUpload(file)
      if (result.success) {
        setMensaje(`✅ ${result.message}`)
        if (fileInputRef.current) fileInputRef.current.value = ''
        await cargarArchivos()
        router.refresh()
        onUploadSuccess?.(result)
      } else {
        setMensaje(`⚠️ ${result.message}`)
      }
    } catch (err: any) {
      setMensaje(`⚠️ Unexpected error: ${err.message}`)
    } finally {
      setSubiendo(false)
    }
  }

  const handleEliminar = async (archivo: FileUpload) => {
    if (!window.confirm(deleteConfirmMessage(archivo.file_name))) {
      return
    }

    setMensaje(`Deleting "${archivo.file_name}"...`)
    try {
      await deleteUploadedFileCompletely(archivo, supabase)
      setMensaje(`✅ File deleted successfully.`)
      await cargarArchivos()
      router.refresh()
      onAfterDelete?.(archivo)
    } catch (err: any) {
      setMensaje(`⚠️ Error deleting file: ${err.message}`)
    }
  }

  const handleReprocesar = async (archivo: FileUpload) => {
    if (!onReprocess) return
    if (!window.confirm(reprocessConfirmMessage(archivo.file_name))) {
      return
    }

    setMensaje(`Restoring ${title.toLowerCase()}...`)
    try {
      const result = await onReprocess(archivo)
      if (result.success) {
        setMensaje(`✅ ${result.message}`)
        router.refresh()
      } else {
        setMensaje(`⚠️ ${result.message}`)
      }
    } catch (err: any) {
      setMensaje(`⚠️ Error restoring: ${err.message}`)
    }
  }

  const filesToDisplay = allowPagination && !mostrarTodos ? archivos.slice(0, 3) : archivos

  return (
    <div className="bg-white p-5 rounded-lg shadow mb-6 border border-gray-200">
      <div className={`flex justify-between items-center ${colapsado ? '' : 'mb-4'}`}>
        <div
          className="flex items-center gap-2 cursor-pointer select-none group"
          onClick={() => setColapsado(!colapsado)}
          title={colapsado ? 'Click to expand' : 'Click to collapse'}
        >
          <h2 className="text-xl font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
            {title}
          </h2>
          <svg
            className={`w-4 h-4 text-gray-400 group-hover:text-indigo-600 transform transition-transform duration-200 ${
              colapsado ? '-rotate-90' : 'rotate-0'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileUpload}
            disabled={subiendo}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={subiendo}
            title="Upload CSV"
            className="inline-flex items-center justify-center w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {subiendo ? (
              <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
          </button>

          <button
            onClick={cargarArchivos}
            disabled={cargando}
            title="Refresh list"
            className="inline-flex items-center justify-center px-2 py-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-md text-xs font-medium transition-colors cursor-pointer h-7"
          >
            <span>↻ Refresh</span>
          </button>
        </div>
      </div>

      {!colapsado && (
        <>
          {mensaje && (
            <p
              className={`mb-4 text-sm font-medium p-3 rounded-md ${
                mensaje.includes('⚠️') ? 'bg-orange-50 text-orange-800' : 'bg-blue-50 text-blue-800'
              }`}
            >
              {mensaje}
            </p>
          )}

          {cargando ? (
            <p className="text-sm text-gray-500">Loading history...</p>
          ) : archivos.length === 0 ? (
            <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filesToDisplay.map((archivo) => (
                      <tr key={archivo.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {renderFileName ? renderFileName(archivo) : archivo.file_name}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-right space-x-3">
                          {onReprocess && (
                            <button
                              onClick={() => handleReprocesar(archivo)}
                              className="text-indigo-600 hover:text-indigo-900 transition-colors cursor-pointer"
                            >
                              {reprocessButtonLabel}
                            </button>
                          )}
                          <button
                            onClick={() => handleEliminar(archivo)}
                            className="text-red-600 hover:text-red-900 transition-colors cursor-pointer font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {allowPagination && archivos.length > 3 && (
                <div className="mt-3 pt-2 border-t border-gray-100 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setMostrarTodos(!mostrarTodos)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{mostrarTodos ? 'Show recent (3)' : `View all snapshots (${archivos.length})`}</span>
                    <svg
                      className={`w-3.5 h-3.5 transform transition-transform duration-200 ${
                        mostrarTodos ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {children}
    </div>
  )
}
