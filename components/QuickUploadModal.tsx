'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { subirArchivoPositions, subirArchivoOriginal, subirArchivoMkTos } from '../lib/storage'
import { procesarFilasPosiciones } from '../lib/positionsParser'
import { procesarFilasMkTos } from '../lib/mkTosParser'
import { parsearFechaTOS } from '../lib/formatters'

interface QuickUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

type ModuleType = 'positions' | 'transactions' | 'mk-tos'

interface SlotState {
  file: File | null
  status: 'idle' | 'checking' | 'ready' | 'processing' | 'success' | 'duplicate' | 'error'
  message: string
}

export default function QuickUploadModal({ isOpen, onClose }: QuickUploadModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [globalLoading, setGlobalLoading] = useState(false)
  const [advertencias, setAdvertencias] = useState<string[]>([])

  const [slots, setSlots] = useState<Record<ModuleType, SlotState>>({
    positions: { file: null, status: 'idle', message: '' },
    transactions: { file: null, status: 'idle', message: '' },
    'mk-tos': { file: null, status: 'idle', message: '' }
  })

  if (!isOpen) return null

  const resetAll = () => {
    setSlots({
      positions: { file: null, status: 'idle', message: '' },
      transactions: { file: null, status: 'idle', message: '' },
      'mk-tos': { file: null, status: 'idle', message: '' }
    })
    setAdvertencias([])
    setGlobalLoading(false)
  }

  const handleClose = () => {
    if (globalLoading) return
    resetAll()
    onClose()
  }

  // Detect matching module by filename and content inspection
  const detectarModulo = async (file: File): Promise<ModuleType | null> => {
    const nombre = file.name.toLowerCase()

    if (nombre.includes('position')) return 'positions'
    if (nombre.includes('transaction')) return 'transactions'
    if (nombre.includes('quote') || nombre.includes('mk-tos') || nombre.includes('mktos')) return 'mk-tos'

    // Fallback: preview first few lines to check headers
    try {
      const slice = file.slice(0, 2048)
      const text = (await slice.text()).toLowerCase()

      if (text.includes('instrument,qty') || text.includes('position statement')) return 'positions'
      if (text.includes('trade_code') || text.includes('exec time') || (text.includes('action') && text.includes('symbol'))) return 'transactions'
      if (text.includes('symbol,description') || text.includes('market depth') || text.includes('52high')) return 'mk-tos'
    } catch {
      // Ignore preview read error
    }

    return null
  }

  // Categorize files and check immediately for duplicates in Supabase
  const clasificarArchivos = async (archivos: FileList | File[]) => {
    const listaArchivos = Array.from(archivos).filter(f => f.name.toLowerCase().endsWith('.csv'))

    if (listaArchivos.length === 0) {
      setAdvertencias(['Please select CSV format files only (.csv)'])
      return
    }

    const nuevosSlots = { ...slots }
    const nuevasAdvertencias: string[] = []

    for (const file of listaArchivos) {
      const modulo = await detectarModulo(file)

      if (!modulo) {
        nuevasAdvertencias.push(`Could not identify the module for "${file.name}". Please make sure the filename includes "Position", "Transaction", or "Quote".`)
        continue
      }

      // Check for duplicates in Supabase file_uploads table
      const { data: archivoExistente } = await supabase
        .from('file_uploads')
        .select('id, file_name, created_at')
        .eq('file_name', file.name)
        .eq('module', modulo)
        .maybeSingle()

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

  const normalizeNumber = (value: string | undefined | null) => {
    if (!value) return 0
    const cleanStr = value.toString().replace(/[^0-9.-]+/g, '')
    const num = parseFloat(cleanStr)
    return isNaN(num) ? 0 : num
  }

  // --- MODULE PROCESSING IMPLEMENTATIONS (BUCKET RULES COMPLIANT) ---

  // 1. POSITIONS: Bucket "Positions", storage_path: `${accountId}/${file.name}`
  const procesarPositions = async (file: File): Promise<string> => {
    const { data: archivoExistente } = await supabase
      .from('file_uploads')
      .select('id')
      .eq('file_name', file.name)
      .eq('module', 'positions')
      .maybeSingle()

    if (archivoExistente) {
      throw new Error(`The file "${file.name}" was already uploaded previously.`)
    }

    const matchAccount = file.name.match(/([A-Z]{3}\d{3})/)
    const accountId = matchAccount ? matchAccount[1] : 'DESCONOCIDO'

    const csvText = await file.text()
    const lineas = csvText.split('\n')
    const statementDate = parsearFechaTOS(lineas[0]) || parsearFechaTOS(file.name) || new Date().toISOString().split('T')[0]

    let headerIndex = 0
    for (let i = 0; i < lineas.length; i++) {
      if (lineas[i].startsWith('Instrument,Qty')) {
        headerIndex = i
        break
      }
    }

    const lineasUtiles = lineas.slice(headerIndex)
    const lineasLimpias = lineasUtiles.map(linea => {
      let l = linea.trim()
      if (l.startsWith('"') && l.endsWith('"')) {
        l = l.substring(1, l.length - 1).replace(/""/g, '"')
      }
      return l
    })
    const csvLimpio = lineasLimpias.join('\n')

    return new Promise((resolve, reject) => {
      Papa.parse(csvLimpio, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          let fileRecordId: string | null = null
          try {
            const filasProcesadas = procesarFilasPosiciones(results.data, statementDate)

            if (filasProcesadas.length === 0) {
              return reject(new Error('No valid position records found in file.'))
            }

            // 1. Upload to Bucket 'Positions'
            const uploadResult = await subirArchivoPositions(file, accountId)
            if (!uploadResult.exito) {
              return reject(new Error(`Storage error: ${uploadResult.error}`))
            }

            // 2. Insert into file_uploads history
            const { data: fileRecord, error: fileRecordError } = await supabase
              .from('file_uploads')
              .insert({
                file_name: file.name,
                module: 'positions',
                storage_path: `${accountId}/${file.name}`
              })
              .select('id')
              .single()

            if (fileRecordError) return reject(new Error(`History error: ${fileRecordError.message}`))
            fileRecordId = fileRecord.id

            // 3. Clear previous snapshot of positions
            await supabase.from('positions').delete().neq('id', '00000000-0000-0000-0000-000000000000')

            // 4. Insert updated positions
            const filasConArchivo = filasProcesadas.map(f => ({ ...f, file_upload_id: fileRecord.id }))
            const { error: insertError } = await supabase.from('positions').insert(filasConArchivo)

            if (insertError) {
              if (fileRecordId) await supabase.from('file_uploads').delete().eq('id', fileRecordId)
              return reject(new Error(`Database error: ${insertError.message}`))
            }

            resolve(`✅ ${filasProcesadas.length} positions updated`)
          } catch (err: any) {
            if (fileRecordId) await supabase.from('file_uploads').delete().eq('id', fileRecordId)
            reject(err)
          }
        }
      })
    })
  }

  // 2. TRANSACTIONS: Bucket "Transactions", storage_path: `Transactions/${accountId}/${file.name}`
  const procesarTransactions = async (file: File): Promise<string> => {
    const { data: archivoExistente } = await supabase
      .from('file_uploads')
      .select('id')
      .eq('file_name', file.name)
      .eq('module', 'transactions')
      .maybeSingle()

    if (archivoExistente) {
      throw new Error(`The file "${file.name}" was already uploaded previously.`)
    }

    const matchAccount = file.name.match(/([A-Z]{3}\d{3})/)
    const accountId = matchAccount ? matchAccount[1] : 'DESCONOCIDO'

    const csvText = await file.text()
    const lineas = csvText.split('\n')
    const lineasLimpias = lineas.map(linea => {
      let l = linea.trim()
      if (l.startsWith('"') && l.endsWith('"')) {
        l = l.substring(1, l.length - 1).replace(/""/g, '"')
      }
      return l
    })
    const csvLimpio = lineasLimpias.join('\n')

    return new Promise((resolve, reject) => {
      Papa.parse(csvLimpio, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          let fileRecordId: string | null = null
          try {
            const filasProcesadas: any[] = []

            for (const row of results.data as any[]) {
              const symbolOriginal = row['Symbol'] || row['symbol']
              if (!symbolOriginal) continue

              let uniqueKey, symbol, instrument: 'Stock' | 'Option'
              const optionMatch = symbolOriginal.match(/^([A-Z]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+(\.\d+)?)\s+([CP])$/)

              if (optionMatch) {
                const ticker = optionMatch[1]
                const parts = optionMatch[2].split('/')
                const expiry = `${parts[1]}/${parts[0]}/${parts[2]}`
                const strike = parseFloat(optionMatch[3])
                const type = optionMatch[5]
                uniqueKey = `${ticker}-${expiry} ${strike} ${type}`
                symbol = ticker
                instrument = 'Option'
              } else {
                uniqueKey = row['unique_key'] || symbolOriginal
                symbol = row['symbol'] || symbolOriginal
                instrument = (row['Instrument'] || row['instrument'] || 'Stock') as 'Stock' | 'Option'
              }

              const realDate = parsearFechaTOS(row['Date'] || row['date'])
              if (!realDate) continue

              const rawCode = row['trade_code']
              const parsedCode = rawCode ? parseInt(rawCode.toString().replace(/[^0-9.-]+/g, '')) : null
              const statusVal = row['position_status'] || row['status'] || 'Open'

              filasProcesadas.push({
                account_id: accountId,
                trade_code: isNaN(parsedCode as number) ? null : parsedCode,
                date: realDate,
                action: row['Action'] || row['action'],
                symbol: symbol,
                instrument: instrument,
                unique_key: uniqueKey,
                quantity: (row['Quantity'] || row['quantity']) ? Math.abs(parseFloat((row['Quantity'] || row['quantity']).toString().replace(/[^0-9.-]+/g, ''))) : 0,
                price: normalizeNumber(row['Price'] || row['price']),
                fees: normalizeNumber(row['Fees & Comm'] || row['fees'] || row['Fees']),
                amount: normalizeNumber(row['Amount'] || row['amount']),
                position_status: statusVal,
                status: statusVal,
                strategy_id: row['strategy_id'] ? parseInt(row['strategy_id']) : null,
                stock_entry_price: instrument === 'Stock' ? normalizeNumber(row['Price'] || row['price']) : (row['stock_entry_price'] ? normalizeNumber(row['stock_entry_price']) : null),
                description: row['description'] || row['Description'] || null
              })
            }

            if (filasProcesadas.length === 0) {
              return reject(new Error('No valid transaction records found in file.'))
            }

            // 1. Upload to Bucket 'Transactions'
            const uploadResult = await subirArchivoOriginal(file, accountId)
            if (!uploadResult.exito) {
              return reject(new Error(`Storage error: ${uploadResult.error}`))
            }

            // 2. Insert into file_uploads with prefix "Transactions/"
            const { data: fileRecord, error: fileRecordError } = await supabase
              .from('file_uploads')
              .insert({
                file_name: file.name,
                module: 'transactions',
                storage_path: `Transactions/${accountId}/${file.name}`
              })
              .select('id')
              .single()

            if (fileRecordError) return reject(new Error(`History error: ${fileRecordError.message}`))
            fileRecordId = fileRecord.id

            // 3. Insert transaction rows
            const filasConArchivo = filasProcesadas.map(f => ({
              ...f,
              file_upload_id: fileRecord.id
            }))

            const { error: insertError } = await supabase
              .from('transactions')
              .insert(filasConArchivo)

            if (insertError) {
              if (fileRecordId) await supabase.from('file_uploads').delete().eq('id', fileRecordId)
              return reject(new Error(`Database error: ${insertError.message}`))
            }

            resolve(`✅ ${filasProcesadas.length} transactions processed`)
          } catch (err: any) {
            if (fileRecordId) await supabase.from('file_uploads').delete().eq('id', fileRecordId)
            reject(err)
          }
        }
      })
    })
  }

  // 3. MK-TOS: Bucket "Mk-tos", storage_path: `${accountId}/${file.name}`, default accountId: 'GENERAL'
  const procesarMkTos = async (file: File): Promise<string> => {
    const { data: archivoExistente } = await supabase
      .from('file_uploads')
      .select('id')
      .eq('file_name', file.name)
      .eq('module', 'mk-tos')
      .maybeSingle()

    if (archivoExistente) {
      throw new Error(`The file "${file.name}" was already uploaded previously.`)
    }

    const matchAccount = file.name.match(/([A-Z]{3}\d{3})/)
    const accountId = matchAccount ? matchAccount[1] : 'GENERAL'

    const csvText = await file.text()
    const lineas = csvText.split('\n')
    const quoteDate = parsearFechaTOS(lineas[0]) || parsearFechaTOS(file.name) || new Date().toISOString().split('T')[0]

    let headerIndex = 0
    for (let i = 0; i < lineas.length; i++) {
      if (lineas[i].startsWith('Symbol,Description')) {
        headerIndex = i
        break
      }
    }

    const lineasUtiles = lineas.slice(headerIndex)
    const csvLimpio = lineasUtiles.join('\n')

    return new Promise((resolve, reject) => {
      Papa.parse(csvLimpio, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          let fileRecordId: string | null = null
          try {
            const filasProcesadas = procesarFilasMkTos(results.data, quoteDate)

            if (filasProcesadas.length === 0) {
              return reject(new Error('No valid quote records found in file.'))
            }

            // 1. Upload to Bucket 'Mk-tos'
            const uploadResult = await subirArchivoMkTos(file, accountId)
            if (!uploadResult.exito) {
              return reject(new Error(`Storage error: ${uploadResult.error}`))
            }

            // 2. Insert into file_uploads
            const { data: fileRecord, error: fileRecordError } = await supabase
              .from('file_uploads')
              .insert({
                file_name: file.name,
                module: 'mk-tos',
                storage_path: `${accountId}/${file.name}`
              })
              .select('id')
              .single()

            if (fileRecordError) return reject(new Error(`History error: ${fileRecordError.message}`))
            fileRecordId = fileRecord.id

            // 3. Insert quote rows
            const filasConArchivo = filasProcesadas.map(f => ({ ...f, file_upload_id: fileRecord.id }))
            const { error: insertError } = await supabase.from('mk_tos_quotes').insert(filasConArchivo)

            if (insertError) {
              if (fileRecordId) await supabase.from('file_uploads').delete().eq('id', fileRecordId)
              return reject(new Error(`Database error: ${insertError.message}`))
            }

            resolve(`✅ ${filasProcesadas.length} symbols processed`)
          } catch (err: any) {
            if (fileRecordId) await supabase.from('file_uploads').delete().eq('id', fileRecordId)
            reject(err)
          }
        }
      })
    })
  }

  // --- PROCESS ALL VALID FILES ---
  const handleProcesarTodo = async () => {
    const modulosParaProcesar = (['positions', 'transactions', 'mk-tos'] as ModuleType[]).filter(
      m => slots[m].file !== null && slots[m].status !== 'duplicate' && slots[m].status !== 'error'
    )

    if (modulosParaProcesar.length === 0) return

    setGlobalLoading(true)
    let algunExito = false
    let huboError = false

    for (const modulo of modulosParaProcesar) {
      const file = slots[modulo].file!

      setSlots(prev => ({
        ...prev,
        [modulo]: { ...prev[modulo], status: 'processing', message: 'Uploading & saving...' }
      }))

      try {
        let msg = ''
        if (modulo === 'positions') msg = await procesarPositions(file)
        if (modulo === 'transactions') msg = await procesarTransactions(file)
        if (modulo === 'mk-tos') msg = await procesarMkTos(file)

        algunExito = true
        setSlots(prev => ({
          ...prev,
          [modulo]: { ...prev[modulo], status: 'success', message: msg }
        }))
      } catch (error: any) {
        huboError = true
        setSlots(prev => ({
          ...prev,
          [modulo]: { ...prev[modulo], status: 'error', message: `⚠️ ${error.message || 'Processing error'}` }
        }))
      }
    }

    setGlobalLoading(false)

    if (algunExito) {
      router.refresh()
    }

    // Si todo se procesó con éxito y sin errores, se cierra automáticamente
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
          title: 'Transactions CSV',
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
