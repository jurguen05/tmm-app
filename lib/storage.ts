import { supabase } from './supabase'

// 1. SUBIR ARCHIVO (Ya la tenías, le agregamos upsert: true)
export const subirArchivoOriginal = async (file: File, accountId: string) => {
  try {
    const filePath = `${accountId}/${file.name}`;
    
    const { data, error } = await supabase.storage
      .from('Transactions')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true // Permite sobreescribir si estamos reprocesando
      });

    if (error) throw error;
    
    return { exito: true, data };
  } catch (error: any) {
    return { exito: false, error: error.message };
  }
};

// 2. ELIMINAR ARCHIVO (Nueva: para cuando borres del historial)
export const eliminarArchivoStorage = async (storagePath: string) => {
  try {
    // La base de datos guarda 'Transactions/ACC123/archivo.csv'
    // Pero Supabase pide la ruta sin el nombre del bucket, así que lo limpiamos:
    const rutaLimpia = storagePath.replace('Transactions/', '');
    
    const { error } = await supabase.storage
      .from('Transactions')
      .remove([rutaLimpia]);

    if (error) throw error;
    
    return { exito: true };
  } catch (error: any) {
    return { exito: false, error: error.message };
  }
};

// 3. DESCARGAR ARCHIVO (Nueva: para cuando quieras Reprocesar un archivo viejo)
export const descargarArchivoStorage = async (storagePath: string) => {
  try {
    const rutaLimpia = storagePath.replace('Transactions/', '');
    
    const { data, error } = await supabase.storage
      .from('Transactions')
      .download(rutaLimpia);

    if (error) throw error;
    
    // Retorna el archivo como un Blob (datos crudos) listo para ser leído por PapaParse
    return { exito: true, data }; 
  } catch (error: any) {
    return { exito: false, error: error.message };
  }
};

export const subirArchivoPositions = async (file: File, accountId: string) => {
  const path = `${accountId}/${file.name}`;
  const { data, error } = await supabase.storage.from('Positions').upload(path, file, {
    upsert: true
  });
  if (error) return { exito: false, error: error.message };
  return { exito: true, data };
};

export const descargarArchivoPositions = async (path: string) => {
  const { data, error } = await supabase.storage.from('Positions').download(path);
  if (error) return { exito: false, error: error.message };
  return { exito: true, data };
};

export const eliminarArchivoPositions = async (path: string) => {
  const { data, error } = await supabase.storage.from('Positions').remove([path]);
  if (error) return { exito: false, error: error.message };
  return { exito: true, data };
};

// ======== FUNCIONES PARA EL BUCKET Mk-tos ========

export const subirArchivoMkTos = async (file: File, accountId: string) => {
  const path = `${accountId}/${file.name}`;
  const { data, error } = await supabase.storage.from('Mk-tos').upload(path, file, {
    upsert: true
  });
  if (error) return { exito: false, error: error.message };
  return { exito: true, data };
};

export const descargarArchivoMkTos = async (path: string) => {
  const { data, error } = await supabase.storage.from('Mk-tos').download(path);
  if (error) return { exito: false, error: error.message };
  return { exito: true, data };
};

export const eliminarArchivoMkTos = async (path: string) => {
  const { data, error } = await supabase.storage.from('Mk-tos').remove([path]);
  if (error) return { exito: false, error: error.message };
  return { exito: true, data };
};