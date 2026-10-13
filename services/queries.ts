// services/queries.ts

import { Transaction, Strategy, Profile, Position, FileUpload, MkTosQuote } from '../types';

type SupabaseClient = any;

// 1. Obtener el perfil del usuario actual
export async function getUserProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error("Error cargando perfil:", error.message);
    return null;
  }
  return data;
}

// 2. Obtener todas las transacciones con JOIN a strategies
export async function getTransactions(supabase: SupabaseClient): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, strategies(name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data || [];
}

// 3. Obtener transacciones por lista de claves únicas (usado para consolidación de estrategias)
export async function getTransactionsByUniqueKeys(supabase: SupabaseClient, uniqueKeys: string[]): Promise<Transaction[]> {
  if (!uniqueKeys || uniqueKeys.length === 0) return [];
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*, strategies(name)')
    .in('unique_key', uniqueKeys);
    
  if (error) throw new Error(error.message);
  return data || [];
}

// 4. Obtener las estrategias activas
export async function getActiveStrategies(supabase: SupabaseClient): Promise<Strategy[]> {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('is_active', true)
    .order('name');
    
  if (error) throw new Error(error.message);
  return data || [];
}

// 5. Actualizar un solo campo de una transacción
export async function updateTransactionField(
  supabase: SupabaseClient, 
  id: string, 
  field: string, 
  value: any
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ [field]: value })
    .eq('id', id);
    
  if (error) throw new Error(error.message);
}

// 6. Borrar transacciones masivamente por IDs
export async function deleteTransactions(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  
  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids);
    
  if (error) throw new Error(error.message);
}

// 7. Borrar transacciones asociadas a un archivo
export async function deleteTransactionsByFileUploadId(supabase: SupabaseClient, fileUploadId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('file_upload_id', fileUploadId);
    
  if (error) throw new Error(error.message);
}

// 8. Insertar transacciones masivamente
export async function insertTransactions(supabase: SupabaseClient, rows: any[]): Promise<void> {
  if (!rows || rows.length === 0) return;
  
  const { error } = await supabase
    .from('transactions')
    .insert(rows);
    
  if (error) throw new Error(error.message);
}

// 9. Obtener posiciones activas
export async function getPositions(supabase: SupabaseClient): Promise<Position[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .order('symbol', { ascending: true });
    
  if (error) throw new Error(error.message);
  return data || [];
}

// 10. Limpiar snapshot previo de posiciones
export async function clearPositionsSnapshot(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('positions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
    
  if (error) throw new Error(error.message);
}

// 11. Insertar posiciones masivamente
export async function insertPositions(supabase: SupabaseClient, rows: any[]): Promise<void> {
  if (!rows || rows.length === 0) return;
  
  const { error } = await supabase
    .from('positions')
    .insert(rows);
    
  if (error) throw new Error(error.message);
}

// 12. Borrar posiciones asociadas a un archivo
export async function deletePositionsByFileUploadId(supabase: SupabaseClient, fileUploadId: string): Promise<void> {
  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('file_upload_id', fileUploadId);
    
  if (error) throw new Error(error.message);
}

// 13. Verificar si un archivo ya fue subido en file_uploads
export async function checkFileUploadExists(
  supabase: SupabaseClient, 
  fileName: string, 
  module: string
): Promise<FileUpload | null> {
  const { data, error } = await supabase
    .from('file_uploads')
    .select('*')
    .eq('file_name', fileName)
    .eq('module', module)
    .maybeSingle();
    
  if (error) throw new Error(error.message);
  return data || null;
}

// 14. Registrar nuevo archivo en file_uploads
export async function createFileUploadRecord(
  supabase: SupabaseClient,
  payload: { file_name: string; module: string; storage_path: string }
): Promise<FileUpload> {
  const { data, error } = await supabase
    .from('file_uploads')
    .insert(payload)
    .select('*')
    .single();
    
  if (error) throw new Error(error.message);
  return data;
}

// 15. Eliminar registro de file_uploads
export async function deleteFileUploadRecord(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from('file_uploads')
    .delete()
    .eq('id', id);
    
  if (error) throw new Error(error.message);
}

// 16. Listar últimos archivos subidos por módulo
export async function getFileUploads(
  supabase: SupabaseClient, 
  module: string, 
  limit = 5
): Promise<FileUpload[]> {
  const { data, error } = await supabase
    .from('file_uploads')
    .select('*')
    .eq('module', module)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) throw new Error(error.message);
  return data || [];
}

// 17. Obtener cotizaciones MK-TOS con paginación y filtro de símbolo
export async function getMkTosQuotes(
  supabase: SupabaseClient,
  params: { page: number; pageSize: number; symbol?: string }
): Promise<{ quotes: MkTosQuote[]; count: number }> {
  const { page, pageSize, symbol } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('mk_tos_quotes')
    .select('*, file_uploads!inner(is_archived)', { count: 'exact' })
    .eq('file_uploads.is_archived', false)
    .order('quote_date', { ascending: false })
    .order('symbol', { ascending: true });

  if (symbol && symbol.trim()) {
    query = query.ilike('symbol', `%${symbol.trim()}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return {
    quotes: data || [],
    count: count || 0
  };
}

// 18. Insertar cotizaciones MK-TOS
export async function insertMkTosQuotes(supabase: SupabaseClient, rows: any[]): Promise<void> {
  if (!rows || rows.length === 0) return;
  
  const { error } = await supabase
    .from('mk_tos_quotes')
    .insert(rows);
    
  if (error) throw new Error(error.message);
}

// 19. Borrar cotizaciones MK-TOS por ID de subida de archivo
export async function deleteMkTosQuotesByFileUploadId(supabase: SupabaseClient, fileUploadId: string): Promise<void> {
  const { error } = await supabase
    .from('mk_tos_quotes')
    .delete()
    .eq('file_upload_id', fileUploadId);
    
  if (error) throw new Error(error.message);
}

// 20. Resumen de contadores para KPIs del Dashboard
export async function getDashboardSummaryCounts(supabase: SupabaseClient): Promise<{
  positionsCount: number;
  transactionsCount: number;
  quotesCount: number;
  strategiesCount: number;
}> {
  const [
    { count: positionsCount },
    { count: transactionsCount },
    { count: quotesCount },
    { count: strategiesCount }
  ] = await Promise.all([
    supabase.from('positions').select('*', { count: 'exact', head: true }),
    supabase.from('transactions').select('*', { count: 'exact', head: true }),
    supabase.from('mk_tos_quotes').select('*', { count: 'exact', head: true }),
    supabase.from('strategies').select('*', { count: 'exact', head: true }).eq('is_active', true)
  ]);

  return {
    positionsCount: positionsCount ?? 0,
    transactionsCount: transactionsCount ?? 0,
    quotesCount: quotesCount ?? 0,
    strategiesCount: strategiesCount ?? 0
  };
}
