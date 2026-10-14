// services/fileUploadService.ts

import Papa from 'papaparse';
import { ModuleType, FileUpload } from '../types';
import { 
  subirArchivoPositions, 
  subirArchivoOriginal, 
  subirArchivoMkTos, 
  eliminarArchivoPositions, 
  eliminarArchivoStorage, 
  eliminarArchivoMkTos,
  descargarArchivoPositions,
  descargarArchivoStorage,
  descargarArchivoMkTos
} from '../lib/storage';
import { 
  checkFileUploadExists, 
  createFileUploadRecord, 
  deleteFileUploadRecord, 
  clearPositionsSnapshot, 
  insertPositions, 
  insertTransactions, 
  insertMkTosQuotes,
  upsertSpyDailyClose,
  deletePositionsByFileUploadId,
  deleteTransactionsByFileUploadId,
  deleteMkTosQuotesByFileUploadId,
  syncTradesForCodes
} from './queries';
import { procesarFilasPosiciones } from '../lib/positionsParser';
import { procesarFilasTransacciones, limpiarTextoCsv, extraerAccountIdDesdeNombre } from '../lib/transactionsParser';
import { procesarFilasMkTos } from '../lib/mkTosParser';
import { parsearFechaTOS } from '../lib/formatters';

export interface IngestionResult {
  success: boolean;
  module: ModuleType;
  fileName: string;
  count: number;
  message: string;
  error?: string;
}

/**
 * Detecta el módulo de destino examinando el nombre del archivo y encabezados
 */
export async function detectarModuloArchivo(file: File): Promise<ModuleType | null> {
  const nombre = file.name.toLowerCase();

  if (nombre.includes('position')) return 'positions';
  if (nombre.includes('transaction')) return 'transactions';
  if (nombre.includes('quote') || nombre.includes('mk-tos') || nombre.includes('mktos')) return 'mk-tos';

  try {
    const slice = file.slice(0, 2048);
    const text = (await slice.text()).toLowerCase();

    if (text.includes('instrument,qty') || text.includes('position statement')) return 'positions';
    if (text.includes('trade_code') || text.includes('exec time') || (text.includes('action') && text.includes('symbol'))) return 'transactions';
    if (text.includes('symbol,description') || text.includes('market depth') || text.includes('52high')) return 'mk-tos';
  } catch {
    // Si falla la previsualización, continuamos con fallback
  }

  return null;
}

/**
 * Procesa la ingesta de un archivo de Posiciones (ThinkorSwim Position Statement)
 */
export async function processPositionsUpload(file: File, supabase: any): Promise<IngestionResult> {
  const existing = await checkFileUploadExists(supabase, file.name, 'positions');
  if (existing) {
    return {
      success: false,
      module: 'positions',
      fileName: file.name,
      count: 0,
      message: `The file "${file.name}" was already uploaded previously. Delete it from History first.`,
      error: 'DUPLICATE_FILE'
    };
  }

  const accountId = extraerAccountIdDesdeNombre(file.name);
  const csvText = await file.text();
  const lineas = csvText.split(/\r?\n/);
  const statementDate = parsearFechaTOS(lineas[0]) || parsearFechaTOS(file.name) || new Date().toISOString().split('T')[0];

  let headerIndex = 0;
  for (let i = 0; i < lineas.length; i++) {
    const cleanLine = lineas[i].replace(/"/g, '').trim();
    if (cleanLine.startsWith('Instrument,Qty')) {
      headerIndex = i;
      break;
    }
  }

  const lineasUtiles = lineas.slice(headerIndex);
  const csvLimpio = limpiarTextoCsv(lineasUtiles.join('\n'));

  return new Promise<IngestionResult>((resolve) => {
    Papa.parse(csvLimpio, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let fileRecordId: string | null = null;
        const storagePath = `${accountId}/${file.name}`;

        try {
          const filasProcesadas = procesarFilasPosiciones(results.data, statementDate);
          if (filasProcesadas.length === 0) {
            return resolve({
              success: false,
              module: 'positions',
              fileName: file.name,
              count: 0,
              message: 'No valid position records found in CSV file.',
              error: 'EMPTY_DATA'
            });
          }

          // 1. Subir al Bucket Storage 'Positions'
          const uploadRes = await subirArchivoPositions(file, accountId);
          if (!uploadRes.exito) {
            return resolve({
              success: false,
              module: 'positions',
              fileName: file.name,
              count: 0,
              message: `Storage error: ${uploadRes.error}`,
              error: uploadRes.error
            });
          }

          // 2. Registrar en file_uploads
          const fileRecord = await createFileUploadRecord(supabase, {
            file_name: file.name,
            module: 'positions',
            storage_path: storagePath
          });
          fileRecordId = fileRecord.id;

          // 3. Limpiar snapshot previo de posiciones
          await clearPositionsSnapshot(supabase);

          // 4. Insertar filas vinculadas al archivo
          const filasConArchivo = filasProcesadas.map(f => ({ ...f, file_upload_id: fileRecord.id }));
          await insertPositions(supabase, filasConArchivo);

          resolve({
            success: true,
            module: 'positions',
            fileName: file.name,
            count: filasProcesadas.length,
            message: `Successfully processed ${filasProcesadas.length} positions.`
          });
        } catch (err: any) {
          // Rollback transaccional ante error
          if (fileRecordId) {
            await deleteFileUploadRecord(supabase, fileRecordId).catch(() => {});
          }
          await eliminarArchivoPositions(storagePath).catch(() => {});

          resolve({
            success: false,
            module: 'positions',
            fileName: file.name,
            count: 0,
            message: `Processing error: ${err.message}`,
            error: err.message
          });
        }
      }
    });
  });
}

/**
 * Procesa la ingesta de un archivo de Transacciones (ThinkorSwim Transactions)
 */
export async function processTransactionsUpload(file: File, supabase: any): Promise<IngestionResult> {
  const existing = await checkFileUploadExists(supabase, file.name, 'transactions');
  if (existing) {
    return {
      success: false,
      module: 'transactions',
      fileName: file.name,
      count: 0,
      message: `The file "${file.name}" was already uploaded previously. Delete it from History first.`,
      error: 'DUPLICATE_FILE'
    };
  }

  const accountId = extraerAccountIdDesdeNombre(file.name);
  const csvText = await file.text();
  const csvLimpio = limpiarTextoCsv(csvText);

  return new Promise<IngestionResult>((resolve) => {
    Papa.parse(csvLimpio, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let fileRecordId: string | null = null;
        const storagePath = `Transactions/${accountId}/${file.name}`;

        try {
          const filasProcesadas = procesarFilasTransacciones(results.data, accountId);
          if (filasProcesadas.length === 0) {
            return resolve({
              success: false,
              module: 'transactions',
              fileName: file.name,
              count: 0,
              message: 'No valid transaction records found in CSV file.',
              error: 'EMPTY_DATA'
            });
          }

          // 1. Subir a Storage Bucket 'Transactions'
          const uploadRes = await subirArchivoOriginal(file, accountId);
          if (!uploadRes.exito) {
            return resolve({
              success: false,
              module: 'transactions',
              fileName: file.name,
              count: 0,
              message: `Storage error: ${uploadRes.error}`,
              error: uploadRes.error
            });
          }

          // 2. Registrar en file_uploads
          const fileRecord = await createFileUploadRecord(supabase, {
            file_name: file.name,
            module: 'transactions',
            storage_path: storagePath
          });
          fileRecordId = fileRecord.id;

          // 3. Insertar transacciones asociadas
          const filasConArchivo = filasProcesadas.map(f => ({ ...f, file_upload_id: fileRecord.id }));
          await insertTransactions(supabase, filasConArchivo);

          // 4. Sincronizar tabla trades automáticamente
          // Obtener los trade_codes reales asignados por el trigger de base de datos
          const { data: insertedTxs } = await supabase
            .from('transactions')
            .select('trade_code')
            .eq('file_upload_id', fileRecord.id);

          const tradeCodes: number[] = Array.from(new Set<number>(
            (insertedTxs || [])
              .map((t: any) => Number(t.trade_code))
              .filter((c: any): c is number => !isNaN(c) && c > 0)
          ));

          if (tradeCodes.length > 0) {
            await syncTradesForCodes(supabase, tradeCodes, accountId);
          }

          resolve({
            success: true,
            module: 'transactions',
            fileName: file.name,
            count: filasProcesadas.length,
            message: `Successfully processed ${filasProcesadas.length} transactions.`
          });
        } catch (err: any) {
          // Rollback transaccional
          if (fileRecordId) {
            await deleteFileUploadRecord(supabase, fileRecordId).catch(() => {});
          }
          await eliminarArchivoStorage(storagePath).catch(() => {});

          resolve({
            success: false,
            module: 'transactions',
            fileName: file.name,
            count: 0,
            message: `Processing error: ${err.message}`,
            error: err.message
          });
        }
      }
    });
  });
}

/**
 * Procesa la ingesta de un archivo MK-TOS (ThinkorSwim Quotes)
 */
export async function processMkTosUpload(file: File, supabase: any): Promise<IngestionResult> {
  const existing = await checkFileUploadExists(supabase, file.name, 'mk-tos');
  if (existing) {
    return {
      success: false,
      module: 'mk-tos',
      fileName: file.name,
      count: 0,
      message: `The file "${file.name}" was already uploaded previously. Delete it from History first.`,
      error: 'DUPLICATE_FILE'
    };
  }

  const accountId = extraerAccountIdDesdeNombre(file.name, 'GENERAL');
  const csvText = await file.text();
  const lineas = csvText.split(/\r?\n/);
  const quoteDate = parsearFechaTOS(lineas[0]) || parsearFechaTOS(file.name) || new Date().toISOString().split('T')[0];

  let headerIndex = 0;
  for (let i = 0; i < lineas.length; i++) {
    const cleanLine = lineas[i].replace(/"/g, '').trim();
    if (cleanLine.startsWith('Symbol,Description') || cleanLine.startsWith('Symbol,')) {
      headerIndex = i;
      break;
    }
  }

  const lineasUtiles = lineas.slice(headerIndex);
  const csvLimpio = limpiarTextoCsv(lineasUtiles.join('\n'));

  return new Promise<IngestionResult>((resolve) => {
    Papa.parse(csvLimpio, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let fileRecordId: string | null = null;
        const storagePath = `${accountId}/${file.name}`;

        try {
          const filasProcesadas = procesarFilasMkTos(results.data, quoteDate);
          if (filasProcesadas.length === 0) {
            return resolve({
              success: false,
              module: 'mk-tos',
              fileName: file.name,
              count: 0,
              message: 'No valid quote records found in CSV file.',
              error: 'EMPTY_DATA'
            });
          }

          // 1. Subir al Storage Bucket 'Mk-tos'
          const uploadRes = await subirArchivoMkTos(file, accountId);
          if (!uploadRes.exito) {
            return resolve({
              success: false,
              module: 'mk-tos',
              fileName: file.name,
              count: 0,
              message: `Storage error: ${uploadRes.error}`,
              error: uploadRes.error
            });
          }

          // 2. Registrar en file_uploads
          const fileRecord = await createFileUploadRecord(supabase, {
            file_name: file.name,
            module: 'mk-tos',
            storage_path: storagePath
          });
          fileRecordId = fileRecord.id;

          // 3. Insertar cotizaciones
          const filasConArchivo = filasProcesadas.map(f => ({ ...f, file_upload_id: fileRecord.id }));
          await insertMkTosQuotes(supabase, filasConArchivo);

          // 4. Registrar SPY vs SMA 10W en spy_daily_closes (historial del filtro de mercado de Weekend Trader).
          //    No es bloqueante: si falla, las cotizaciones ya quedaron cargadas y el calculador usa SPY de mk_tos_quotes.
          let spyWarning = '';
          const spyRow = filasProcesadas.find(f => (f.symbol || '').trim().toUpperCase() === 'SPY');
          if (spyRow && spyRow.last_price > 0 && spyRow.sma_10w > 0) {
            try {
              await upsertSpyDailyClose(supabase, {
                quote_date: spyRow.quote_date,
                spy_last: spyRow.last_price,
                spy_sma_10w: spyRow.sma_10w,
                file_upload_id: fileRecord.id
              });
            } catch (spyErr: any) {
              console.warn('[processMkTosUpload] Could not save SPY daily close:', spyErr.message);
              spyWarning = ' (Warning: SPY market filter history was not saved)';
            }
          } else {
            spyWarning = ' (Warning: SPY row with Last and SMA 10W not found in this file)';
          }

          resolve({
            success: true,
            module: 'mk-tos',
            fileName: file.name,
            count: filasProcesadas.length,
            message: `Successfully processed ${filasProcesadas.length} quote records.${spyWarning}`
          });
        } catch (err: any) {
          // Rollback transaccional
          if (fileRecordId) {
            await deleteFileUploadRecord(supabase, fileRecordId).catch(() => {});
          }
          await eliminarArchivoMkTos(storagePath).catch(() => {});

          resolve({
            success: false,
            module: 'mk-tos',
            fileName: file.name,
            count: 0,
            message: `Processing error: ${err.message}`,
            error: err.message
          });
        }
      }
    });
  });
}

/**
 * Re-procesa un archivo previamente subido descargándolo desde Storage
 */
export async function reprocessUploadedFile(fileRecord: FileUpload, supabase: any): Promise<IngestionResult> {
  const { module, storage_path, file_name, id } = fileRecord;

  if (module === 'transactions') {
    const res = await descargarArchivoStorage(storage_path);
    if (!res.exito || !res.data) throw new Error(res.error || 'Failed to download file');

    const csvText = await res.data.text();
    const csvLimpio = limpiarTextoCsv(csvText);
    const accountId = extraerAccountIdDesdeNombre(file_name);

    return new Promise((resolve, reject) => {
      Papa.parse(csvLimpio, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const filasProcesadas = procesarFilasTransacciones(results.data, accountId, id);
            await deleteTransactionsByFileUploadId(supabase, id);
            await insertTransactions(supabase, filasProcesadas);

            // Sincronizar tabla trades automáticamente con los trade_codes asignados
            const { data: insertedTxs } = await supabase
              .from('transactions')
              .select('trade_code')
              .eq('file_upload_id', id);

            const tradeCodes: number[] = Array.from(new Set<number>(
              (insertedTxs || [])
                .map((t: any) => Number(t.trade_code))
                .filter((c: any): c is number => !isNaN(c) && c > 0)
            ));

            if (tradeCodes.length > 0) {
              await syncTradesForCodes(supabase, tradeCodes, accountId);
            }

            resolve({
              success: true,
              module: 'transactions',
              fileName: file_name,
              count: filasProcesadas.length,
              message: `Reprocessed ${filasProcesadas.length} transactions.`
            });
          } catch (err: any) {
            reject(err);
          }
        }
      });
    });
  }

  if (module === 'positions') {
    const res = await descargarArchivoPositions(storage_path);
    if (!res.exito || !res.data) throw new Error(res.error || 'Failed to download file');

    const csvText = await res.data.text();
    const lineas = csvText.split(/\r?\n/);
    const statementDate = parsearFechaTOS(lineas[0]) || parsearFechaTOS(file_name) || new Date().toISOString().split('T')[0];
    
    let headerIndex = 0;
    for (let i = 0; i < lineas.length; i++) {
      const cleanLine = lineas[i].replace(/"/g, '').trim();
      if (cleanLine.startsWith('Instrument,Qty')) {
        headerIndex = i;
        break;
      }
    }
    const csvLimpio = limpiarTextoCsv(lineas.slice(headerIndex).join('\n'));

    return new Promise((resolve, reject) => {
      Papa.parse(csvLimpio, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const filasProcesadas = procesarFilasPosiciones(results.data, statementDate, id);
            await clearPositionsSnapshot(supabase);
            await insertPositions(supabase, filasProcesadas);
            resolve({
              success: true,
              module: 'positions',
              fileName: file_name,
              count: filasProcesadas.length,
              message: `Reprocessed ${filasProcesadas.length} positions.`
            });
          } catch (err: any) {
            reject(err);
          }
        }
      });
    });
  }

  throw new Error(`Reprocessing not supported for module ${module}`);
}

/**
 * Elimina completamente un archivo del sistema: borra datos de DB, registro en file_uploads y archivo en Storage.
 */
export async function deleteUploadedFileCompletely(fileRecord: FileUpload, supabase: any): Promise<void> {
  const { id, storage_path, module } = fileRecord;

  if (module === 'transactions') {
    // 1. Identificar trade_codes afectados antes de borrar
    const { data: affectedTxs } = await supabase
      .from('transactions')
      .select('trade_code')
      .eq('file_upload_id', id);

    const affectedCodes: number[] = Array.from(new Set(
      (affectedTxs || [])
        .map((t: any) => Number(t.trade_code))
        .filter((c: number) => !isNaN(c) && c > 0)
    ));

    // 2. Borrar transacciones del archivo y archivo en Storage
    await deleteTransactionsByFileUploadId(supabase, id).catch(() => {});
    await eliminarArchivoStorage(storage_path).catch(() => {});

    // 3. Rollback automático: recalcular balance neto (Opción 1) de los trades restantes
    if (affectedCodes.length > 0) {
      await syncTradesForCodes(supabase, affectedCodes);
    }
  } else if (module === 'positions') {
    await deletePositionsByFileUploadId(supabase, id).catch(() => {});
    await eliminarArchivoPositions(storage_path).catch(() => {});
  } else if (module === 'mk-tos') {
    await deleteMkTosQuotesByFileUploadId(supabase, id).catch(() => {});
    await eliminarArchivoMkTos(storage_path).catch(() => {});
  }

  await deleteFileUploadRecord(supabase, id);
}
