// lib/storage.ts
import { supabase } from './supabase'

export type StorageBucket = 'Transactions' | 'Positions' | 'Mk-tos'

export interface StorageOperationResult<T = any> {
  exito: boolean
  data?: T
  error?: string
}

/**
 * Operación genérica para subir un archivo a cualquier bucket de Supabase Storage.
 * Aplica upsert: true para permitir reprocesamiento seguro.
 */
export async function uploadToStorage(
  bucket: StorageBucket,
  path: string,
  file: File
): Promise<StorageOperationResult> {
  try {
    const cleanPath = path.startsWith(`${bucket}/`) ? path.replace(`${bucket}/`, '') : path
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(cleanPath, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) throw error
    return { exito: true, data }
  } catch (error: any) {
    return { exito: false, error: error.message }
  }
}

/**
 * Operación genérica para descargar un archivo de cualquier bucket de Supabase Storage.
 */
export async function downloadFromStorage(
  bucket: StorageBucket,
  path: string
): Promise<StorageOperationResult<Blob>> {
  try {
    const cleanPath = path.startsWith(`${bucket}/`) ? path.replace(`${bucket}/`, '') : path
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(cleanPath)

    if (error) throw error
    return { exito: true, data: data as Blob }
  } catch (error: any) {
    return { exito: false, error: error.message }
  }
}

/**
 * Operación genérica para eliminar un archivo de cualquier bucket de Supabase Storage.
 */
export async function deleteFromStorage(
  bucket: StorageBucket,
  path: string
): Promise<StorageOperationResult> {
  try {
    const cleanPath = path.startsWith(`${bucket}/`) ? path.replace(`${bucket}/`, '') : path
    const { error } = await supabase.storage
      .from(bucket)
      .remove([cleanPath])

    if (error) throw error
    return { exito: true }
  } catch (error: any) {
    return { exito: false, error: error.message }
  }
}

// ============================================================================
// Funciones de compatibilidad hacia atrás (delegadas a las funciones genéricas)
// ============================================================================

export const subirArchivoOriginal = (file: File, accountId: string) =>
  uploadToStorage('Transactions', `${accountId}/${file.name}`, file)

export const eliminarArchivoStorage = (storagePath: string) =>
  deleteFromStorage('Transactions', storagePath)

export const descargarArchivoStorage = (storagePath: string) =>
  downloadFromStorage('Transactions', storagePath)

export const subirArchivoPositions = (file: File, accountId: string) =>
  uploadToStorage('Positions', `${accountId}/${file.name}`, file)

export const descargarArchivoPositions = (path: string) =>
  downloadFromStorage('Positions', path)

export const eliminarArchivoPositions = (path: string) =>
  deleteFromStorage('Positions', path)

export const subirArchivoMkTos = (file: File, accountId: string) =>
  uploadToStorage('Mk-tos', `${accountId}/${file.name}`, file)

export const descargarArchivoMkTos = (path: string) =>
  downloadFromStorage('Mk-tos', path)

export const eliminarArchivoMkTos = (path: string) =>
  deleteFromStorage('Mk-tos', path)