'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { ModuleType } from '../types'
import { 
  checkFileUploadExists 
} from '../services/queries'
import { 
  detectarModuloArchivo, 
  processPositionsUpload, 
  processTransactionsUpload, 
  processMkTosUpload 
} from '../services/fileUploadService'
import ReviewNewTradesModal from './ReviewNewTradesModal'

interface QuickUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

interface SlotState {
  file: File | null
  status: 'idle' | 'checking' | 'ready' | 'processing' | 'success' | 'duplicate' | 'error'
  message: string
}

export default function QuickUploadModal({ isOpen, onClose }: QuickUploadModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'enrich'>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [globalLoading, setGlobalLoading] = useState(false)
  const [advertencias, setAdvertencias] = useState<string[]>([])
  const [enrichTradeCodes, setEnrichTradeCodes] = useState<number[]>([])

  const [slots, setSlots] = useState<Record<ModuleType, SlotState>>({
    positions: { file: null, status: 'idle', message: '' },
    transactions: { file: null, status: 'idle', message: '' },
    'mk-tos': { file: null, status: 'idle', message: '' }
  })

  if (!isOpen) return null

  const resetAll = () => {
    setStep('upload')
    setSlots({
      positions: { file: null, status: 'idle', message: '' },
      transactions: { file: null, status: 'idle', message: '' },
      'mk-tos': { file: null, status: 'idle', message: '' }
    })
    setAdvertencias([])
    setGlobalLoading(false)
    setEnrichTradeCodes([])
  }

  const handleClose = () => {
    if (globalLoading) return
    resetAll()
    onClose()
  }

  // Clasifica los archivos y valida duplicados contra la base de datos
  const clasificarArchivos = async (archivos: FileList | File[]) => {
    const listaArchivos = Array.from(archivos).filter(f => f.name.toLowerCase().endsWith('.csv'))

    if (listaArchivos.length === 0) {
      setAdvertencias(['Please select CSV format files only (.csv)'])
      return
    }

    const nuevosSlots = { ...slots }
    const nuevasAdvertencias: string[] = []

    for (const file of listaArchivos) {
      const modulo = await detectarModuloArchivo(file)

      if (!modulo) {
        nuevasAdvertencias.push(`Could not identify the module for "${file.name}". Please make sure the filename includes "Position", "Transaction", or "Quote".`)
        continue
      }

      // Consulta de duplicados mediante la capa de servicios
      const archivoExistente = await checkFileUploadExists(supabase, file.name, modulo)

      if (archivoExistente) {
        nuevosSlots[modulo] = {
          file: file,
          status: 'duplicate',
          message: `⚠️ Already uploaded previously. If you wish to replace it, delete it from History first.`
        }
      } else {
        nuevosSlots[modulo] = {
          file: file,
          status: 'ready',
          message: 'File ready to process'
        }
      }
    }

    setSlots(nuevosSlots)
    setAdvertencias(nuevasAdvertencias)
  }

  // Drag & drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await clasificarArchivos(e.dataTransfer.files)
    }
  }

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await clasificarArchivos(e.target.files)
      e.target.value = ''
    }
  }

  const handleRemoverArchivo = (modulo: ModuleType) => {
    if (globalLoading) return
    setSlots(prev => ({
      ...prev,
      [modulo]: { file: null, status: 'idle', message: '' }
    }))
  }

  // Procesa todos los archivos listos delegando a la capa de aplicación
  const handleProcesarTodo = async () => {
    const modulosParaProcesar = (['positions', 'transactions', 'mk-tos'] as ModuleType[]).filter(
      m => slots[m].file !== null && slots[m].status !== 'duplicate' && slots[m].status !== 'error'
    )

    if (modulosParaProcesar.length === 0) return

    setGlobalLoading(true)
    let algunExito = false
    let huboError = false
    let insertedTradeCodes: number[] = []

    for (const modulo of modulosParaProcesar) {
      const file = slots[modulo].file!

      setSlots(prev => ({
        ...prev,
        [modulo]: { ...prev[modulo], status: 'processing', message: 'Uploading & saving...' }
      }))

      try {
        let result
        if (modulo === 'positions') {
          result = await processPositionsUpload(file, supabase)
        } else if (modulo === 'transactions') {
          result = await processTransactionsUpload(file, supabase)
          if (result.success && result.tradeCodes && result.tradeCodes.length > 0) {
            insertedTradeCodes = result.tradeCodes
          }
        } else {
          result = await processMkTosUpload(file, supabase)
        }

        if (result.success) {
          algunExito = true
          setSlots(prev => ({
            ...prev,
            [modulo]: { ...prev[modulo], status: 'success', message: result.message }
          }))
        } else {
          huboError = true
          setSlots(prev => ({
            ...prev,
            [modulo]: { ...prev[modulo], status: 'error', message: `⚠️ ${result.message}` }
          }))
        }
      } catch (error: any) {
        huboError = true
        setSlots(prev => ({
          ...prev,
          [modulo]: { ...prev[modulo], status: 'error', message: `⚠️ ${error.message || 'Processing error'}` }
        }))
      }
    }

    setGlobalLoading(false)

    // Si se subieron transacciones con éxito y sin error, verificar si hay trades para enriquecer
    if (algunExito && !huboError && insertedTradeCodes.length > 0) {
      console.log('%c[QuickUploadModal] Switching step to "enrich" with trade codes:', 'color: #8b5cf6; font-weight: bold;', insertedTradeCodes)
      setEnrichTradeCodes(insertedTradeCodes)
      setStep('enrich')
      return
    }

        if (algunExito) {
      console.log('%c[QuickUploadModal] router.refresh() triggered after upload (no enrichment needed)', 'color: #8b5cf6; font-weight: bold;')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tmm:portfolio-data-changed'))
      }
      router.refresh()
    }

    // Si todo se procesó con éxito y sin errores ni necesidad de enriquecimiento, cerrar automáticamente en 1 segundo
    if (algunExito && !huboError) {
      setTimeout(() => {
        resetAll()
        onClose()
      }, 1000)
    }
  }

  const cantidadArchivosSeleccionados = Object.values(slots).filter(s => s.file !== null).length
  const archivosListosParaSubir = Object.values(slots).filter(s => s.file !== null && s.status !== 'duplicate' && s.status !== 'error').length

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getModuleInfo = (mod: ModuleType) => {
    switch (mod) {
      case 'positions':
        return {
          title: 'Positions Statement',
          shortName: 'Positions',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: '📊'
        }
      case 'transactions':
        return {
          title: 'Transactions Activity',
          shortName: 'Transactions',
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: '💳'
        }
      case 'mk-tos':
        return {
          title: 'MK-TOS Quotes',
          shortName: 'MK-TOS',
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: '📈'
        }
    }
  }

  if (step === 'enrich') {
    console.log('%c[QuickUploadModal] Rendering Step 2 modal (ReviewNewTradesModal)', 'color: #8b5cf6; font-weight: bold;', {
      enrichTradeCodes,
      time: new Date().toISOString()
    })
    return (
      <ReviewNewTradesModal
        isOpen={true}
        tradeCodes={enrichTradeCodes}
        onClose={() => {
          resetAll()
          onClose()
        }}
        onSaved={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tmm:portfolio-data-changed'))
          }
          resetAll()
          onClose()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-150 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">CSVs Upload</h2>
              <p className="text-xs text-gray-500">Automatically detects Positions, Transactions and MK-TOS files</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={globalLoading}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 cursor-pointer"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* DRAG & DROP ZONE */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !globalLoading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50/70'
            } ${globalLoading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              accept=".csv"
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">
              Drag & drop 1 or more CSV files here, or <span className="text-indigo-600 underline">browse files</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              You can drop all 3 files together or one by one (max 1 file per module at a time).
            </p>
          </div>

          {/* WARNINGS / UNRECOGNIZED FILES */}
          {advertencias.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
              {advertencias.map((adv, idx) => (
                <p key={idx} className="text-xs text-amber-800 font-medium flex items-center gap-1.5">
                  <span>⚠️</span> {adv}
                </p>
              ))}
            </div>
          )}

          {/* MODULE STATUS CARDS */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Identified Files ({cantidadArchivosSeleccionados} of 3)
            </h3>

            {(['positions', 'transactions', 'mk-tos'] as ModuleType[]).map(mod => {
              const info = getModuleInfo(mod)
              const slot = slots[mod]

              return (
                <div
                  key={mod}
                  className={`border rounded-xl p-4 transition-all ${
                    slot.status === 'duplicate'
                      ? 'border-red-300 bg-red-50/40'
                      : slot.file
                      ? 'border-indigo-200 bg-white shadow-sm'
                      : 'border-gray-200 bg-gray-50/50 border-dashed'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">{info.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">{info.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.badgeColor}`}>
                            {info.shortName}
                          </span>
                        </div>
                        {slot.file ? (
                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            📄 <span className="font-medium text-gray-800">{slot.file.name}</span>
                            <span className="text-gray-400 ml-1.5">({formatBytes(slot.file.size)})</span>
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-0.5">No file assigned yet</p>
                        )}
                      </div>
                    </div>

                    {/* STATUS / ACTION BADGES */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {slot.status === 'processing' && (
                        <span className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                          <svg className="animate-spin h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Processing...
                        </span>
                      )}

                      {slot.status === 'ready' && (
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200">
                          Ready to upload
                        </span>
                      )}

                      {slot.status === 'duplicate' && (
                        <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-md border border-red-200">
                          Duplicate
                        </span>
                      )}

                      {slot.status === 'success' && (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                          {slot.message}
                        </span>
                      )}

                      {slot.file && slot.status !== 'processing' && (
                        <button
                          onClick={() => handleRemoverArchivo(mod)}
                          disabled={globalLoading}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DUPLICATE OR ERROR DETAILS */}
                  {(slot.status === 'duplicate' || slot.status === 'error') && (
                    <div className={`mt-2 text-xs font-medium p-2 rounded border ${
                      slot.status === 'duplicate' ? 'text-red-800 bg-red-50/80 border-red-200' : 'text-orange-800 bg-orange-50 border-orange-200'
                    }`}>
                      {slot.message}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={resetAll}
            disabled={globalLoading || cantidadArchivosSeleccionados === 0}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium disabled:opacity-40 cursor-pointer"
          >
            Clear selection
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              disabled={globalLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 cursor-pointer"
            >
              {Object.values(slots).some(s => s.status === 'success') ? 'Close' : 'Cancel'}
            </button>

            <button
              onClick={handleProcesarTodo}
              disabled={globalLoading || archivosListosParaSubir === 0}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {globalLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>
                    Upload & Process {archivosListosParaSubir > 0 ? `(${archivosListosParaSubir})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
