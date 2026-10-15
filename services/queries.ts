// services/queries.ts

import { Transaction, Strategy, Profile, Position, FileUpload, MkTosQuote, Trade, SpyDailyClose } from '../types';
import { calcularEstadoTradeDesdeTransacciones } from '../lib/transactionsParser';
import { parsearFechaTOS, calcularDiasHabilesDiferencia } from '../lib/formatters';
import { seleccionarArchivosMkTosParaArchivar, MK_TOS_ACTIVE_QUOTE_DATES } from '../lib/archivePolicy';

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

// 2. Obtener las transacciones iniciales vinculadas con la tabla maestra trades (50 registros para control visual)
export async function getTransactions(supabase: SupabaseClient, limit = 50): Promise<Transaction[]> {
  const { data: txsData, error: txError } = await supabase
    .from('transactions')
    .select('*, strategies(name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (txError) throw new Error(txError.message);
  const txs: Transaction[] = txsData || [];
  if (txs.length === 0) return [];

  // Filtrar solo los trade_codes presentes en las transacciones obtenidas
  const uniqueCodes = Array.from(new Set(
    txs
      .map(t => Number(t.trade_code))
      .filter((c): c is number => !isNaN(c) && c > 0)
  ));

  if (uniqueCodes.length === 0) return txs;

  const { data: tradesData, error: tradesError } = await supabase
    .from('trades')
    .select('trade_code, strategy_id, status, stock_entry_price, strategies(name)')
    .in('trade_code', uniqueCodes);

  if (tradesError) {
    console.warn('[getTransactions] Error fetching trades:', tradesError.message);
    return txs;
  }

  const tradesMap = new Map<number, any>();
  for (const tr of tradesData || []) {
    if (tr.trade_code !== null && tr.trade_code !== undefined && !isNaN(Number(tr.trade_code))) {
      tradesMap.set(Number(tr.trade_code), tr);
    }
  }

  return txs.map((t) => {
    const codeNum = t.trade_code ? Number(t.trade_code) : null;
    if (codeNum && tradesMap.has(codeNum)) {
      const tr = tradesMap.get(codeNum)!;
      return {
        ...t,
        strategy_id: tr.strategy_id ?? t.strategy_id,
        strategies: tr.strategies || (tr.strategy_id ? t.strategies : t.strategies),
        strategy: tr.strategies?.name || t.strategy,
        position_status: tr.status ?? t.position_status,
        stock_entry_price: tr.stock_entry_price ?? t.stock_entry_price,
        trade: tr
      };
    }
    return t;
  });
}

// 2b. Buscar transacciones en el servidor filtradas por código, símbolo, estrategia o estado trayendo todo el historial
export async function getFilteredTransactions(
  supabase: SupabaseClient,
  filters: { trade_code?: string; symbol?: string; strategy?: string; status?: string },
  limit = 2000
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*, strategies(name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.trade_code && filters.trade_code.trim()) {
    const codeNum = parseInt(filters.trade_code.trim(), 10);
    if (!isNaN(codeNum)) {
      query = query.eq('trade_code', codeNum);
    }
  }

  if (filters.symbol && filters.symbol.trim()) {
    query = query.ilike('symbol', `%${filters.symbol.trim()}%`);
  }

  if (filters.status && filters.status.trim() && filters.status.toLowerCase() !== 'all') {
    const statusVal = filters.status.trim();
    const { data: stTrades } = await supabase
      .from('trades')
      .select('trade_code')
      .ilike('status', statusVal);
    const stCodes = ((stTrades as any[]) || []).map((t: any) => t.trade_code).filter((c: any): c is number => c !== null && c !== undefined);
    if (stCodes.length > 0) {
      query = query.or(`position_status.ilike.${statusVal},trade_code.in.(${stCodes.join(',')})`);
    } else {
      query = query.ilike('position_status', statusVal);
    }
  }

  if (filters.strategy && filters.strategy.trim() && filters.strategy.toLowerCase() !== 'all') {
    const stratName = filters.strategy.trim();
    const { data: stratData } = await supabase
      .from('strategies')
      .select('id')
      .eq('name', stratName)
      .maybeSingle();

    if (stratData?.id) {
      const { data: stratTrades } = await supabase
        .from('trades')
        .select('trade_code')
        .eq('strategy_id', stratData.id);
      const codes = ((stratTrades as any[]) || []).map((t: any) => t.trade_code).filter((c: any): c is number => c !== null && c !== undefined);
      if (codes.length > 0) {
        query = query.or(`strategy_id.eq.${stratData.id},trade_code.in.(${codes.join(',')})`);
      } else {
        query = query.eq('strategy_id', stratData.id);
      }
    }
  }

  const { data: txsData, error: txError } = await query;
  if (txError) throw new Error(txError.message);
  let txs: Transaction[] = txsData || [];
  if (txs.length === 0) return [];

  const uniqueCodes = Array.from(new Set(
    txs
      .map(t => Number(t.trade_code))
      .filter((c): c is number => !isNaN(c) && c > 0)
  ));

  let tradesMap = new Map<number, any>();
  if (uniqueCodes.length > 0) {
    const { data: tradesData, error: tradesError } = await supabase
      .from('trades')
      .select('trade_code, strategy_id, status, stock_entry_price, strategies(name)')
      .in('trade_code', uniqueCodes);

    if (!tradesError && tradesData) {
      for (const tr of tradesData) {
        if (tr.trade_code !== null && tr.trade_code !== undefined && !isNaN(Number(tr.trade_code))) {
          tradesMap.set(Number(tr.trade_code), tr);
        }
      }
    }
  }

  let enriched = txs.map((t) => {
    const codeNum = t.trade_code ? Number(t.trade_code) : null;
    if (codeNum && tradesMap.has(codeNum)) {
      const tr = tradesMap.get(codeNum)!;
      return {
        ...t,
        strategy_id: tr.strategy_id ?? t.strategy_id,
        strategies: tr.strategies || t.strategies,
        strategy: tr.strategies?.name || t.strategy,
        position_status: tr.status ?? t.position_status,
        stock_entry_price: tr.stock_entry_price ?? t.stock_entry_price,
        trade: tr
      };
    }
    return t;
  });

  if (filters.strategy && filters.strategy.trim() && filters.strategy.toLowerCase() !== 'all') {
    enriched = enriched.filter(t => (t.strategies?.name || t.strategy) === filters.strategy);
  }

  return enriched;
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
  
  // Limpiar payload para evitar campos virtuales/UI que no existen en el esquema de la base de datos
  const cleanRows = rows.map(r => {
    const { strategy, trade, strategies, codigo, ...dbRow } = r;
    return dbRow;
  });

  const { error } = await supabase
    .from('transactions')
    .insert(cleanRows);
    
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

// 17. Obtener cotizaciones MK-TOS: por defecto sólo las del ÚLTIMO archivo cargado (control visual), o de toda la base al filtrar por símbolo
export async function getMkTosQuotes(
  supabase: SupabaseClient,
  params: { page: number; pageSize: number; symbol?: string }
): Promise<{ quotes: MkTosQuote[]; count: number; latestFileName?: string; isFiltered: boolean }> {
  const { page, pageSize, symbol } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const isFiltered = Boolean(symbol && symbol.trim());
  let latestFileName: string | undefined;

  let query = supabase
    .from('mk_tos_quotes')
    .select('*, file_uploads!inner(is_archived, file_name, created_at)', { count: 'exact' })
    .eq('file_uploads.is_archived', false)
    .order('quote_date', { ascending: false })
    .order('symbol', { ascending: true });

  if (isFiltered) {
    // Cuando el usuario usa el filtro por símbolo, busca en todos los archivos cargados históricamente
    query = query.ilike('symbol', `%${symbol!.trim()}%`);
  } else {
    // Sin filtro: control visual exclusivo del ÚLTIMO archivo cargado
    const { data: latestFile } = await supabase
      .from('file_uploads')
      .select('id, file_name')
      .eq('module', 'mk-tos')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestFile) {
      latestFileName = latestFile.file_name;
      query = query.eq('file_upload_id', latestFile.id);
    } else {
      return {
        quotes: [],
        count: 0,
        latestFileName: undefined,
        isFiltered: false
      };
    }
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return {
    quotes: data || [],
    count: count || 0,
    latestFileName,
    isFiltered
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

// Columnas de mk_tos_quotes realmente usadas por strategiesCalculator (ver MkTosQuote en types/index.ts)
const MK_TOS_QUOTE_COLUMNS =
  'id, quote_date, symbol, last_price, high_price, low_52, low_100_day, ema, bollinger_bands, sma_10w, mac_stop, trendpilot_stop';
const MK_TOS_PAGE_SIZE = 1000;
const MK_TOS_PARALLEL_PAGES = 3;

// 21. Obtener cotizaciones vigentes de MK-TOS (opcionalmente filtradas por símbolos)
// Pagina con range() porque PostgREST limita cada respuesta a 1000 filas por defecto.
export async function getLatestMkTosQuotes(
  supabase: SupabaseClient,
  symbols?: string[]
): Promise<MkTosQuote[]> {
  const fetchPage = async (page: number): Promise<MkTosQuote[]> => {
    const from = page * MK_TOS_PAGE_SIZE;
    let query = supabase
      .from('mk_tos_quotes')
      .select(`${MK_TOS_QUOTE_COLUMNS}, file_uploads!inner(is_archived)`)
      .eq('file_uploads.is_archived', false)
      .order('quote_date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + MK_TOS_PAGE_SIZE - 1);

    if (symbols && symbols.length > 0) {
      query = query.in('symbol', symbols);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as unknown as MkTosQuote[];
  };

  // Se piden varias páginas a la vez (en vez de una tras otra) para evitar sumar latencias.
  const all: MkTosQuote[] = [];
  for (let page = 0; ; page += MK_TOS_PARALLEL_PAGES) {
    const batch = await Promise.all(
      Array.from({ length: MK_TOS_PARALLEL_PAGES }, (_, i) => fetchPage(page + i))
    );
    for (const rows of batch) {
      all.push(...rows);
      if (rows.length < MK_TOS_PAGE_SIZE) return all;
    }
  }
}

// 21b. Registrar (o actualizar) el cierre diario de SPY vs SMA 10W para el filtro de mercado de Weekend Trader
export async function upsertSpyDailyClose(
  supabase: SupabaseClient,
  row: { quote_date: string; spy_last: number; spy_sma_10w: number; file_upload_id?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('spy_daily_closes')
    .upsert(row, { onConflict: 'quote_date' });

  if (error) throw new Error(error.message);
}

// 21c. Obtener el historial de cierres diarios de SPY (independiente de los archivos MK-TOS archivados)
export async function getSpyDailyCloses(supabase: SupabaseClient): Promise<SpyDailyClose[]> {
  const { data, error } = await supabase
    .from('spy_daily_closes')
    .select('quote_date, spy_last, spy_sma_10w, is_red, file_upload_id')
    .order('quote_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// 21d. Listar archivos MK-TOS activos (no archivados) con su fecha de cotización.
// Todas las filas de un archivo comparten quote_date, así que alcanza con leer una fila por archivo.
export async function getActiveMkTosFilesWithDate(
  supabase: SupabaseClient
): Promise<{ id: string; quote_date: string | null }[]> {
  const { data: files, error } = await supabase
    .from('file_uploads')
    .select('id')
    .eq('module', 'mk-tos')
    .eq('is_archived', false);

  if (error) throw new Error(error.message);
  if (!files || files.length === 0) return [];

  return Promise.all(
    files.map(async (f: { id: string }) => {
      const { data, error: qErr } = await supabase
        .from('mk_tos_quotes')
        .select('quote_date')
        .eq('file_upload_id', f.id)
        .limit(1)
        .maybeSingle();

      if (qErr) throw new Error(qErr.message);
      const raw = data?.quote_date as string | undefined;
      return { id: f.id, quote_date: raw ? (parsearFechaTOS(raw) || raw.substring(0, 10)) : null };
    })
  );
}

// 21e. Marcar archivos como archivados (reversible: is_archived = false los reactiva).
// Devuelve cuántos se archivaron: si RLS bloquea el UPDATE, PostgREST no da error sino 0 filas.
export async function archiveFileUploads(supabase: SupabaseClient, ids: string[]): Promise<number> {
  if (!ids || ids.length === 0) return 0;

  const { data, error } = await supabase
    .from('file_uploads')
    .update({ is_archived: true })
    .in('id', ids)
    .select('id');

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

// 21f. Ejecutar archivado automático de archivos MK-TOS antiguos manteniendo los últimos N días de cotización (por defecto 10)
export async function autoArchiveOldMkTosFiles(
  supabase: SupabaseClient,
  keepDates: number = MK_TOS_ACTIVE_QUOTE_DATES
): Promise<{ checked: number; archived: number }> {
  try {
    const files = await getActiveMkTosFilesWithDate(supabase);
    const toArchiveIds = seleccionarArchivosMkTosParaArchivar(files, keepDates);
    
    if (toArchiveIds.length === 0) {
      return { checked: files.length, archived: 0 };
    }

    const count = await archiveFileUploads(supabase, toArchiveIds);
    console.log(`[autoArchiveOldMkTosFiles] Automatically archived ${count} old MK-TOS files.`);
    return { checked: files.length, archived: count };
  } catch (err: any) {
    console.warn('[autoArchiveOldMkTosFiles] Error executing auto-archive:', err.message);
    return { checked: 0, archived: 0 };
  }
}

// 22. Obtener todas las transacciones asociadas a una lista de trade_codes
export async function getTransactionsByTradeCodes(
  supabase: SupabaseClient,
  tradeCodes: (number | string)[]
): Promise<Transaction[]> {
  if (!tradeCodes || tradeCodes.length === 0) return [];

  const validCodes = tradeCodes
    .map(c => Number(c))
    .filter(c => !isNaN(c) && c > 0);

  if (validCodes.length === 0) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*, strategies(name)')
    .in('trade_code', validCodes)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

// 23. Obtener todos los trades (con filtros opcionales de status y symbol)
export async function getTrades(
  supabase: SupabaseClient,
  filters?: { status?: string; symbol?: string }
): Promise<Trade[]> {
  let query = supabase
    .from('trades')
    .select('*, strategies(name)')
    .order('first_buy_date', { ascending: false, nullsFirst: false })
    .order('trade_code', { ascending: false });

  if (filters?.status && filters.status !== 'All') {
    query = query.eq('status', filters.status);
  }

  if (filters?.symbol && filters.symbol.trim()) {
    query = query.ilike('symbol', `%${filters.symbol.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[getTrades] Warning:', error.message);
    return [];
  }
  return data || [];
}

// 24. Obtener trades abiertos con su estrategia asignada
export async function getOpenTrades(supabase: SupabaseClient): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*, strategies(name)')
    .eq('status', 'Open')
    .order('symbol', { ascending: true });

  if (error) {
    console.warn('[getOpenTrades] Warning:', error.message);
    return [];
  }
  return data || [];
}

// 25. Obtener trades por lista de trade_codes
export async function getTradesByCodes(
  supabase: SupabaseClient,
  tradeCodes: (number | string)[]
): Promise<Trade[]> {
  if (!tradeCodes || tradeCodes.length === 0) return [];

  const validCodes = tradeCodes
    .map(c => Number(c))
    .filter(c => !isNaN(c) && c > 0);

  if (validCodes.length === 0) return [];

  const { data, error } = await supabase
    .from('trades')
    .select('*, strategies(name)')
    .in('trade_code', validCodes);

  if (error) {
    console.warn('[getTradesByCodes] Warning:', error.message);
    return [];
  }
  return data || [];
}

// 26. Actualizar un campo de un trade por trade_code
export async function updateTradeField(
  supabase: SupabaseClient,
  tradeCode: number,
  field: string,
  value: any
): Promise<void> {
  const updates: Record<string, any> = { [field]: value };
  if (field === 'status' && value === 'Closed') {
    updates.max_stock_price = null;
    updates.max_stock_price_date = null;
  }

  const { error } = await supabase
    .from('trades')
    .update(updates)
    .eq('trade_code', tradeCode);

  if (error) throw new Error(error.message);
}

// 26b. Actualizar campos en todas las transacciones vinculadas a un trade_code
export async function updateTransactionsByTradeCode(
  supabase: SupabaseClient,
  tradeCode: number,
  field: string,
  value: any
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ [field]: value })
    .eq('trade_code', tradeCode);

  if (error) console.warn('[updateTransactionsByTradeCode] Warning:', error.message);
}

// 27. Insertar o actualizar trades masivamente
export async function upsertTrades(
  supabase: SupabaseClient,
  rows: Partial<Trade>[]
): Promise<void> {
  if (!rows || rows.length === 0) return;

  const { error } = await supabase
    .from('trades')
    .upsert(rows, { onConflict: 'trade_code' });

  if (error) throw new Error(error.message);
}

// 28. Sincronizar tabla trades a partir de transacciones subidas
export async function syncTradesForCodes(
  supabase: SupabaseClient,
  tradeCodes: number[],
  defaultAccountId?: string
): Promise<void> {
  const uniqueCodes = Array.from(new Set(tradeCodes.filter(c => !isNaN(c) && c > 0)));
  if (uniqueCodes.length === 0) return;

  try {
    // 1. Obtener trades ya existentes
    const { data: existingTrades, error: errExist } = await supabase
      .from('trades')
      .select('trade_code, strategy_id, stock_entry_price, first_buy_date, status, weekend_trader_flag')
      .in('trade_code', uniqueCodes);

    if (errExist) {
      console.warn('[syncTradesForCodes] Tabla trades no disponible:', errExist.message);
      return;
    }

    const existingMap = new Map<number, any>();
    (existingTrades || []).forEach((t: any) => existingMap.set(Number(t.trade_code), t));

    // 2. Obtener las transacciones vinculadas
    const { data: txs, error: errTxs } = await supabase
      .from('transactions')
      .select('*')
      .in('trade_code', uniqueCodes)
      .order('date', { ascending: true });

    if (errTxs) return;

    const txsList = txs || [];
    const txsByCode = new Map<number, Transaction[]>();
    for (const t of txsList) {
      const code = Number(t.trade_code);
      if (!txsByCode.has(code)) txsByCode.set(code, []);
      txsByCode.get(code)!.push(t);
    }

    // Limpieza de trades huérfanos: si un trade_code ya no tiene ninguna transacción (ej: se borró el archivo)
    const codesWithTxs = new Set(txsByCode.keys());
    const orphanCodes = uniqueCodes.filter(c => !codesWithTxs.has(c));
    if (orphanCodes.length > 0) {
      await supabase.from('trades').delete().in('trade_code', orphanCodes).catch(() => {});
    }

    const tradesToUpsert: Partial<Trade>[] = [];

    for (const [code, codeTxs] of txsByCode.entries()) {
      const existing = existingMap.get(code);

      // Buscar primera compra cronológica
      const primeraCompra = codeTxs.find(t => 
        (t.amount !== null && t.amount !== undefined && t.amount < 0) ||
        (t.action && t.action.toLowerCase().includes('buy'))
      ) || codeTxs[0];

      const firstBuyDate = primeraCompra?.date || codeTxs[0]?.date || null;
      const initialEntryPrice = primeraCompra?.stock_entry_price ?? (primeraCompra?.instrument === 'Stock' ? primeraCompra?.price : null);
      const symbol = codeTxs[0]?.symbol || '';
      const uniqueKey = codeTxs[0]?.unique_key || symbol;
      const accountId = codeTxs[0]?.account_id || defaultAccountId || null;

      const txConStrategy = codeTxs.find(t => t.strategy_id !== null && t.strategy_id !== undefined);
      const strategyId = existing?.strategy_id ?? (txConStrategy?.strategy_id ?? null);

      // REGLA OPCIÓN 1: Calcular estado ('Open' o 'Closed') a partir del balance neto de cantidades
      const calculatedStatus = calcularEstadoTradeDesdeTransacciones(codeTxs);

      const normDateStr = firstBuyDate ? (parsearFechaTOS(firstBuyDate) || firstBuyDate.substring(0, 10)) : null;
      const isWeekendTrade = Boolean(
        codeTxs.some(t => {
          const sName = t.strategies?.name || t.strategy || '';
          return sName.toLowerCase().includes('weekend');
        })
      );
      const isBeforeCutoff = Boolean(normDateStr && normDateStr < '2026-07-24');
      const initialWeekendFlag = isWeekendTrade && isBeforeCutoff;

      if (!existing) {
        tradesToUpsert.push({
          trade_code: code,
          symbol,
          unique_key: uniqueKey,
          strategy_id: strategyId,
          stock_entry_price: initialEntryPrice,
          first_buy_date: firstBuyDate,
          status: calculatedStatus,
          weekend_trader_flag: calculatedStatus === 'Closed' ? false : initialWeekendFlag,
          max_stock_price: calculatedStatus === 'Closed' ? null : undefined,
          max_stock_price_date: calculatedStatus === 'Closed' ? null : undefined,
          account_id: accountId
        });
      } else {
        const updateObj: Partial<Trade> = {
          trade_code: code,
          symbol: existing.symbol || symbol,
          unique_key: existing.unique_key || uniqueKey,
          status: calculatedStatus,
          first_buy_date: existing.first_buy_date || firstBuyDate,
          stock_entry_price: existing.stock_entry_price ?? initialEntryPrice
        };
        if (calculatedStatus === 'Closed') {
          updateObj.max_stock_price = null;
          updateObj.max_stock_price_date = null;
          updateObj.weekend_trader_flag = false;
        } else if (isWeekendTrade && isBeforeCutoff) {
          updateObj.weekend_trader_flag = true;
        }
        tradesToUpsert.push(updateObj);
      }

      // Sincronizar las transacciones hijas para que coincidan con el status calculado
      await updateTransactionsByTradeCode(supabase, code, 'position_status', calculatedStatus).catch(() => {});
    }

    if (tradesToUpsert.length > 0) {
      await upsertTrades(supabase, tradesToUpsert);
    }
  } catch (error: any) {
    console.warn('[syncTradesForCodes] Error en sincronización:', error.message);
  }
}

// 29. Actualizar max_stock_price, max_stock_price_date y weekend_trader_flag para trades abiertos
export async function updateTradesMaxStockPrices(
  supabase: SupabaseClient,
  items: { 
    trade_code: number; 
    max_stock_price: number | null; 
    max_stock_price_date: string | null;
    weekend_trader_flag?: boolean;
  }[]
): Promise<number> {
  if (!items || items.length === 0) return 0;
  let failed = 0;
  await Promise.all(items.map(async (item) => {
    try {
      const payload: any = {
        max_stock_price: item.max_stock_price,
        max_stock_price_date: item.max_stock_price_date
      };
      if (item.weekend_trader_flag === true) {
        payload.weekend_trader_flag = true;
      }
      const { error } = await supabase
        .from('trades')
        .update(payload)
        .eq('trade_code', item.trade_code)
        .eq('status', 'Open');
      if (error) failed++;
    } catch {
      // Fallback seguro si la columna aún no está creada en DB
      failed++;
    }
  }));
  // Devuelve la cantidad de actualizaciones fallidas (el archivado automático solo corre si es 0)
  return failed;
}

// 30. Actualizar permanentemente weekend_trader_flag a true para trades abiertos
export async function updateTradesWeekendTraderFlags(
  supabase: SupabaseClient,
  tradeCodes: number[]
): Promise<void> {
  if (!tradeCodes || tradeCodes.length === 0) return;
  try {
    await supabase
      .from('trades')
      .update({ weekend_trader_flag: true })
      .in('trade_code', tradeCodes)
      .eq('status', 'Open');
  } catch (err: any) {
    console.warn('[updateTradesWeekendTraderFlags] Error:', err.message);
  }
}

// 30b. Actualizar ratchet_stop para trades abiertos (New Yearly Highs y 100-day-High)
export async function updateTradesRatchetStops(
  supabase: SupabaseClient,
  items: { trade_code: number; ratchet_stop: number | null }[]
): Promise<void> {
  if (!items || items.length === 0) return;
  await Promise.all(items.map(async (item) => {
    try {
      await supabase
        .from('trades')
        .update({ ratchet_stop: item.ratchet_stop })
        .eq('trade_code', item.trade_code)
        .eq('status', 'Open');
    } catch (err: unknown) {
      // Fallback seguro si la columna aún no está creada en DB
      console.warn('[updateTradesRatchetStops] Note/Error:', err instanceof Error ? err.message : String(err));
    }
  }));
}

// 31. Obtener estado de frescura y sincronización de archivos para Strategies Stops
export interface FreshnessStatus {
  positions: {
    date: string | null;
    isLatest: boolean;
    status: 'green' | 'yellow' | 'gray';
    tooltip: string;
  };
  mkTos: {
    date: string | null;
    isSynced: boolean;
    status: 'green' | 'yellow' | 'gray';
    tooltip: string;
  };
  transactions: {
    date: string | null;
    isAhead: boolean;
    status: 'green' | 'yellow' | 'gray';
    tooltip: string;
  };
}

export async function getStrategiesStopsFreshness(
  supabase: SupabaseClient,
  activePositions: Position[]
): Promise<FreshnessStatus> {
  const [latestPosUpload, latestMkTosUpload, latestTxRow, latestQuoteRow] = await Promise.all([
    supabase
      .from('file_uploads')
      .select('id, file_name, created_at')
      .eq('module', 'positions')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('file_uploads')
      .select('id, file_name, created_at')
      .eq('module', 'mk-tos')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('mk_tos_quotes')
      .select('quote_date')
      .order('quote_date', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const activePos = activePositions && activePositions.length > 0 ? activePositions[0] : null;
  const posDate = activePos ? (parsearFechaTOS(activePos.statement_date) || activePos.statement_date?.substring(0, 10)) : null;

  // Fecha del último archivo de cotizaciones MK-TOS
  let mkDate = latestQuoteRow?.data?.quote_date 
    ? (parsearFechaTOS(latestQuoteRow.data.quote_date) || latestQuoteRow.data.quote_date?.substring(0, 10)) 
    : null;
    
  if (!mkDate && latestMkTosUpload?.data?.file_name) {
    mkDate = parsearFechaTOS(latestMkTosUpload.data.file_name);
  }
  
  // 1. Positions Status (con simetría si se sube MK-TOS primero)
  let posStatus: 'green' | 'yellow' | 'gray' = 'gray';
  let isLatestPos = false;
  let posTooltip = 'No positions loaded.';

  if (activePos && posDate) {
    const latestPosFile = latestPosUpload?.data;
    if (latestPosFile) {
      if (activePos.file_upload_id && activePos.file_upload_id === latestPosFile.id) {
        isLatestPos = true;
      } else {
        const latestDateInName = parsearFechaTOS(latestPosFile.file_name);
        if (latestDateInName && latestDateInName === posDate) {
          isLatestPos = true;
        }
      }
    } else {
      isLatestPos = true;
    }

    const posBusinessDays = calcularDiasHabilesDiferencia(posDate);

    if (!isLatestPos) {
      posStatus = 'yellow';
      posTooltip = 'Viewing an older historical snapshot (not the latest uploaded statement).';
    } else if (posBusinessDays >= 2) {
      posStatus = 'yellow';
      posTooltip = `Warning: Positions statement is out of date (${posBusinessDays} business days behind). Please upload a recent file.`;
    } else if (mkDate && mkDate > posDate) {
      // Simetría: Si subiste primero MK-TOS con fecha más nueva, Positions queda en amarillo avisando que falta subir la foto de hoy
      posStatus = 'yellow';
      posTooltip = `Notice: Positions (${posDate}) is lagging behind MK-TOS (${mkDate}). Please upload today's Positions file.`;
    } else {
      posStatus = 'green';
      posTooltip = 'Positions reflect the latest uploaded statement and are up to date.';
    }
  }

  // 2. MK-TOS Status (con simetría si se sube Positions primero)
  let mkStatus: 'green' | 'yellow' | 'gray' = 'gray';
  let isSynced = false;
  let mkTooltip = 'No MK-TOS quote data available.';

  if (mkDate) {
    const mkBusinessDays = calcularDiasHabilesDiferencia(mkDate);

    if (mkBusinessDays >= 2) {
      isSynced = Boolean(posDate && mkDate === posDate);
      mkStatus = 'yellow';
      mkTooltip = `Warning: MK-TOS quotes are out of date (${mkBusinessDays} business days behind). Please upload a recent file.`;
    } else if (posDate && posDate > mkDate) {
      // Simetría: Si subiste primero Positions con fecha más nueva, MK-TOS queda en amarillo avisando que falta subir las cotizaciones de hoy
      isSynced = false;
      mkStatus = 'yellow';
      mkTooltip = `Notice: MK-TOS quotes (${mkDate}) are lagging behind Positions (${posDate}). Please upload today's MK-TOS file.`;
    } else {
      isSynced = true;
      mkStatus = 'green';
      mkTooltip = 'Market quotes are up to date and synchronized with positions.';
    }
  }

  // 3. Transactions Status
  const txRawDate = latestTxRow?.data?.date;
  const txDate = txRawDate ? (parsearFechaTOS(txRawDate) || txRawDate?.substring(0, 10)) : null;

  let txStatus: 'green' | 'yellow' | 'gray' = 'gray';
  let isAhead = false;
  let txTooltip = 'No transactions recorded.';

  if (txDate) {
    if (posDate && txDate > posDate) {
      isAhead = true;
      txStatus = 'yellow';
      txTooltip = `Notice: Transactions date (${txDate}) is newer than current Positions date (${posDate}).`;
    } else {
      txStatus = 'green';
      txTooltip = `Transactions are up to date relative to positions (last trade date: ${txDate}).`;
    }
  }

  return {
    positions: {
      date: posDate,
      isLatest: isLatestPos,
      status: posStatus,
      tooltip: posTooltip
    },
    mkTos: {
      date: mkDate,
      isSynced: isSynced,
      status: mkStatus,
      tooltip: mkTooltip
    },
    transactions: {
      date: txDate,
      isAhead: isAhead,
      status: txStatus,
      tooltip: txTooltip
    }
  };
}


