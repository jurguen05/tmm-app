// services/queries.ts

import { Transaction, Strategy, Profile, Position, FileUpload, MkTosQuote, Trade, SpyDailyClose, TradeEnrichmentItem } from '../types';
import { calcularEstadoTradeDesdeTransacciones, calcularCurrentQuantityDesdeTransacciones, calcularDeltaQuantity } from '../lib/transactionsParser';
import { extraerCashBalanceDesdeCsv } from '../lib/positionsParser';
import { parsearFechaTOS, calcularDiasHabilesDiferencia, normalizeUniqueKey } from '../lib/formatters';
import { seleccionarArchivosMkTosParaArchivar, MK_TOS_ACTIVE_QUOTE_DATES } from '../lib/archivePolicy';
import { calculateStrategyExitMetrics } from '../lib/strategiesCalculator';

export { calculateStrategyExitMetrics };

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
    .select('*')
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

  let allTxs: Transaction[] = txs;
  if (limit <= 200) {
    const { data: siblingTxs } = await supabase
      .from('transactions')
      .select('*')
      .in('trade_code', uniqueCodes)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (siblingTxs && siblingTxs.length > txs.length) {
      const seenIds = new Set(siblingTxs.map((s: any) => s.id));
      const orphans = txs.filter(t => !seenIds.has(t.id));
      allTxs = [...siblingTxs, ...orphans];
    }
  }

  const { data: tradesData, error: tradesError } = await supabase
    .from('trades')
    .select('*, strategies(name)')
    .in('trade_code', uniqueCodes);

  if (tradesError) {
    console.warn('[getTransactions] Error fetching trades:', tradesError.message);
    return allTxs;
  }

  const tradesMap = new Map<number, any>();
  for (const tr of tradesData || []) {
    if (tr.trade_code !== null && tr.trade_code !== undefined && !isNaN(Number(tr.trade_code))) {
      tradesMap.set(Number(tr.trade_code), tr);
    }
  }


  return allTxs.map((t): Transaction => {
    const codeNum = t.trade_code ? Number(t.trade_code) : null;
    if (codeNum && tradesMap.has(codeNum)) {
      const tr = tradesMap.get(codeNum)!;
      return {
        ...t,
        symbol: t.symbol || tr.symbol,
        unique_key: t.unique_key || tr.unique_key,
        instrument: (t.instrument || tr.instrument || 'Stock') as 'Stock' | 'Option',
        strategies: tr.strategies || null,
        strategy: tr.strategies?.name || null,
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
    .select('*')
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
    const symVal = filters.symbol.trim();
    const { data: symTrades } = await supabase
      .from('trades')
      .select('trade_code')
      .ilike('symbol', `%${symVal}%`);
    const symCodes = ((symTrades as any[]) || []).map((t: any) => t.trade_code).filter((c: any): c is number => c !== null && c !== undefined);
    if (symCodes.length > 0) {
      query = query.or(`symbol.ilike.%${symVal}%,trade_code.in.(${symCodes.join(',')})`);
    } else {
      query = query.ilike('symbol', `%${symVal}%`);
    }
  }

  if (filters.status && filters.status.trim() && filters.status.toLowerCase() !== 'all') {
    const statusVal = filters.status.trim();
    const { data: stTrades } = await supabase
      .from('trades')
      .select('trade_code')
      .ilike('status', statusVal);
    const stCodes = ((stTrades as any[]) || []).map((t: any) => t.trade_code).filter((c: any): c is number => c !== null && c !== undefined);
    if (stCodes.length > 0) {
      query = query.in('trade_code', stCodes);
    } else {
      query = query.in('trade_code', [-999999]);
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
        query = query.in('trade_code', codes);
      } else {
        query = query.in('trade_code', [-999999]);
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

  // Traer transacciones hermanas para completar los grupos de trade_code (soporta fusiones/cambio de símbolo)
  let allTxs: Transaction[] = txs;
  if (uniqueCodes.length > 0) {
    const { data: siblingTxs } = await supabase
      .from('transactions')
      .select('*')
      .in('trade_code', uniqueCodes)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (siblingTxs && siblingTxs.length > txs.length) {
      const seenIds = new Set(siblingTxs.map((s: any) => s.id));
      const orphans = txs.filter(t => !seenIds.has(t.id));
      allTxs = [...siblingTxs, ...orphans];
    }
  }

  let tradesMap = new Map<number, any>();
  if (uniqueCodes.length > 0) {
    const { data: tradesData, error: tradesError } = await supabase
      .from('trades')
      .select('*, strategies(name)')
      .in('trade_code', uniqueCodes);

    if (!tradesError && tradesData) {
      for (const tr of tradesData) {
        if (tr.trade_code !== null && tr.trade_code !== undefined && !isNaN(Number(tr.trade_code))) {
          tradesMap.set(Number(tr.trade_code), tr);
        }
      }
    }
  }


  let enriched: Transaction[] = allTxs.map((t): Transaction => {
    const codeNum = t.trade_code ? Number(t.trade_code) : null;
    if (codeNum && tradesMap.has(codeNum)) {
      const tr = tradesMap.get(codeNum)!;
      return {
        ...t,
        symbol: t.symbol || tr.symbol,
        unique_key: t.unique_key || tr.unique_key,
        instrument: (t.instrument || tr.instrument || 'Stock') as 'Stock' | 'Option',
        strategies: tr.strategies || null,
        strategy: tr.strategies?.name || null,
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

// 3. Obtener transacciones por lista de claves únicas (resolviendo desde la tabla maestra trades por unique_key)
export async function getTransactionsByUniqueKeys(supabase: SupabaseClient, uniqueKeys: string[]): Promise<Transaction[]> {
  if (!uniqueKeys || uniqueKeys.length === 0) return [];

  // 1. Buscar en la tabla maestra 'trades' los trade_codes que corresponden a esos unique_keys o símbolos abiertos
  const symbols = Array.from(new Set(uniqueKeys.map(k => {
    const dash = k.indexOf('-');
    return dash !== -1 ? k.substring(0, dash).trim() : k.trim();
  }).filter(Boolean)));

  const [{ data: tradesData }, { data: openTradesBySym }] = await Promise.all([
    supabase
      .from('trades')
      .select('*, strategies(name)')
      .in('unique_key', uniqueKeys),
    symbols.length > 0
      ? supabase
          .from('trades')
          .select('*, strategies(name)')
          .in('symbol', symbols)
          .eq('status', 'Open')
      : Promise.resolve({ data: [] } as any)
  ]);

  const tradesMap = new Map<number, any>();
  const tradeCodes: number[] = [];
  const allMasterTrades = [...(tradesData || []), ...(openTradesBySym || [])];
  for (const tr of allMasterTrades) {
    const c = Number(tr.trade_code);
    if (!isNaN(c) && c > 0 && !tradesMap.has(c)) {
      tradesMap.set(c, tr);
      tradeCodes.push(c);
    }
  }

  // 2. Consultar transacciones por trade_code (y por unique_key como respaldo histórico)
  const queries: Promise<any>[] = [
    supabase
      .from('transactions')
      .select('*')
      .in('unique_key', uniqueKeys)
  ];
  if (tradeCodes.length > 0) {
    queries.push(
      supabase
        .from('transactions')
        .select('*')
        .in('trade_code', tradeCodes)
    );
  }

  const results = await Promise.all(queries);
  const txMap = new Map<string, Transaction>();
  for (const res of results) {
    if (res.error) throw new Error(res.error.message);
    for (const t of res.data || []) {
      const codeNum = t.trade_code ? Number(t.trade_code) : null;
      const tr = codeNum && tradesMap.has(codeNum) ? tradesMap.get(codeNum)! : null;
      txMap.set(t.id, tr ? {
        ...t,
        symbol: tr.symbol || t.symbol,
        unique_key: tr.unique_key || t.unique_key,
        instrument: (tr.instrument || t.instrument) as 'Stock' | 'Option',
        strategies: tr.strategies || null,
        strategy: tr.strategies?.name || null,
        trade: tr
      } : t);
    }
  }

  return Array.from(txMap.values());
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
  
  // Limpiar payload para evitar campos virtuales/UI o removidos que no existen en el esquema de la base de datos
  const cleanRows = rows.map(r => {
    const { strategy, trade, strategies, codigo, position_status, strategy_id, stock_entry_price, _isExistingDuplicate, _origIdx, ...dbRow } = r;
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
    .select('*')
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

// 24b. Obtener todos los trades cerrados con paginación segura
export async function getAllClosedTrades(supabase: SupabaseClient): Promise<Trade[]> {
  const pageSize = 1000;
  const allTrades: Trade[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('trades')
      .select('*, strategies(name)')
      .eq('status', 'Closed')
      .order('closed_date', { ascending: true, nullsFirst: false })
      .order('trade_code', { ascending: true })
      .range(from, to);

    if (error) {
      console.warn('[getAllClosedTrades] Warning:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allTrades.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  return allTrades;
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
  value: any,
  extraUpdates?: Record<string, any>
): Promise<void> {
  const updates: Record<string, any> = { [field]: value, ...(extraUpdates || {}) };
  if (field === 'status' && value === 'Closed') {
    updates.max_stock_price = null;
    updates.max_stock_price_date = null;
    if (!updates.closed_date) {
      updates.closed_date = new Date().toISOString().substring(0, 10);
    }
  } else if (field === 'status' && value === 'Open') {
    updates.closed_date = null;
    updates.exit_price = null;
    updates.exit_stop = null;
    updates.exit_signal = null;
    updates.realized_pnl = null;
  }

  const { error } = await supabase
    .from('trades')
    .update(updates)
    .eq('trade_code', tradeCode);

  if (error) {
    if (extraUpdates && Object.keys(extraUpdates).length > 0) {
      const fallbackUpdates: Record<string, any> = { [field]: value };
      if (field === 'status' && value === 'Closed') {
        fallbackUpdates.max_stock_price = null;
        fallbackUpdates.max_stock_price_date = null;
      }
      const { error: fbErr } = await supabase
        .from('trades')
        .update(fallbackUpdates)
        .eq('trade_code', tradeCode);
      if (fbErr) throw new Error(fbErr.message);
      return;
    }
    throw new Error(error.message);
  }
}



// 26c. Cerrar un trade registrando sus métricas de salida (exit_stop, exit_price, exit_signal, closed_date)
export async function closeTradeWithExitMetrics(
  supabase: SupabaseClient,
  tradeCode: number,
  explicitMetrics?: {
    exit_stop?: number | null;
    exit_price?: number | null;
    exit_signal?: number | null;
    closed_date?: string | null;
  }
): Promise<void> {
  const today = new Date().toISOString().substring(0, 10);
  const payload: Record<string, any> = {
    status: 'Closed',
    closed_date: explicitMetrics?.closed_date || today,
    max_stock_price: null,
    max_stock_price_date: null,
    weekend_trader_flag: false
  };

  if (explicitMetrics?.exit_stop !== undefined && explicitMetrics.exit_stop !== null && typeof explicitMetrics.exit_stop === 'number') {
    payload.exit_stop = explicitMetrics.exit_stop;
  }
  if (explicitMetrics?.exit_price !== undefined && explicitMetrics.exit_price !== null && typeof explicitMetrics.exit_price === 'number') {
    payload.exit_price = explicitMetrics.exit_price;
  }
  if (explicitMetrics?.exit_signal !== undefined && explicitMetrics.exit_signal !== null && typeof explicitMetrics.exit_signal === 'number') {
    payload.exit_signal = explicitMetrics.exit_signal;
  }

  // Si faltó alguna métrica de salida o realized_pnl, buscarla desde el trade y su cotización en MK-TOS
  try {
    const { data: tr } = await supabase
      .from('trades')
      .select('*, strategies(name)')
      .eq('trade_code', tradeCode)
      .maybeSingle();

    if (tr) {
      if (tr.cash_flow !== null && tr.cash_flow !== undefined) {
        payload.realized_pnl = Number(tr.cash_flow);
      }
      if ((payload.exit_price === undefined || payload.exit_stop === undefined) && tr.symbol) {
        const { data: quote } = await supabase
          .from('mk_tos_quotes')
          .select('last_price, mac_stop, trendpilot_stop, low_52, low_100_day, ema, bollinger_bands')
          .eq('symbol', tr.symbol.trim().toUpperCase())
          .order('quote_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const sName = ((tr.strategies as any)?.name || '');
        const calculated = calculateStrategyExitMetrics(
          sName,
          quote,
          tr.stock_entry_price,
          tr.max_stock_price,
          tr.ratchet_stop,
          tr.weekend_trader_flag,
          payload.exit_price
        );

        if (payload.exit_price === undefined) payload.exit_price = calculated.exit_price;
        if (payload.exit_stop === undefined) payload.exit_stop = calculated.exit_stop;
        if (payload.exit_signal === undefined) payload.exit_signal = calculated.exit_signal;
      }
    }
  } catch (err: unknown) {
    console.warn('[closeTradeWithExitMetrics] Warning al consultar cotizaciones:', err instanceof Error ? err.message : String(err));
  }

  try {
    const { error } = await supabase
      .from('trades')
      .update(payload)
      .eq('trade_code', tradeCode);

    if (error) {
      await supabase
        .from('trades')
        .update({ status: 'Closed', max_stock_price: null, max_stock_price_date: null })
        .eq('trade_code', tradeCode);
    }
  } catch {
    await supabase.from('trades').update({ status: 'Closed' }).eq('trade_code', tradeCode);
  }
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

  // Eliminar columnas autogeneradas (id, created_at, updated_at) y relaciones virtuales (strategies)
  // para evitar que PostgREST incluya "id" en ?columns=... y envíe id=null en filas nuevas del lote
  const cleanRows = rows.map((r: any) => {
    const { id, created_at, updated_at, strategies, ...rest } = r;
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) {
        cleaned[k] = v;
      }
    }
    return cleaned;
  });

  const { error } = await supabase
    .from('trades')
    .upsert(cleanRows, { onConflict: 'trade_code' });

  if (error) {
    if (error.message && error.message.includes('instrument')) {
      const fallbackRows = cleanRows.map(({ instrument, ...rest }) => rest);
      const { error: fbErr } = await supabase
        .from('trades')
        .upsert(fallbackRows, { onConflict: 'trade_code' });
      if (fbErr) throw new Error(fbErr.message);
      return;
    }
    throw new Error(error.message);
  }
}

// 27b. Resolver y generar trade_code en la tabla maestra 'trades' a partir de unique_key antes de insertar en 'transactions'
export async function resolveAndAssignTradesForTransactions(
  supabase: SupabaseClient,
  rows: any[],
  defaultAccountId?: string
): Promise<{ rowsWithCodes: any[]; tradeCodes: number[]; newTradeCodes: number[] }> {
  if (!rows || rows.length === 0) {
    return { rowsWithCodes: [], tradeCodes: [], newTradeCodes: [] };
  }

  // 1. Obtener el máximo trade_code actual entre trades y transactions
  const [{ data: maxTradeRow }, { data: maxTxRow }] = await Promise.all([
    supabase
      .from('trades')
      .select('trade_code')
      .order('trade_code', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('trade_code')
      .not('trade_code', 'is', null)
      .order('trade_code', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const maxInTrades = maxTradeRow?.trade_code ? Number(maxTradeRow.trade_code) : 1;
  const maxInTxs = maxTxRow?.trade_code ? Number(maxTxRow.trade_code) : 1;
  let nextTradeCode = Math.max(isNaN(maxInTrades) ? 1 : maxInTrades, isNaN(maxInTxs) ? 1 : maxInTxs, 1) + 1;

  // 2. Extraer claves y símbolos de las transacciones entrantes
  const rawKeys = Array.from(new Set(rows.map(r => r.unique_key || r.symbol).filter(Boolean)));
  const rawSymbols = Array.from(new Set(rows.map(r => (r.symbol || '').trim().toUpperCase()).filter(Boolean)));
  const keysToQuery = new Set<string>();
  for (const k of rawKeys) {
    keysToQuery.add(k);
    keysToQuery.add(normalizeUniqueKey(k));
    const match = String(k).trim().match(/^([A-Z]+)-(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/i);
    if (match) {
      const ticker = match[1].toUpperCase();
      const p1 = match[2].padStart(2, '0');
      const p2 = match[3].padStart(2, '0');
      const yyyy = match[4];
      const rest = match[5];
      keysToQuery.add(`${ticker}-${p1}/${p2}/${yyyy} ${rest}`);
      keysToQuery.add(`${ticker}-${p2}/${p1}/${yyyy} ${rest}`);
    }
  }
  const uniqueKeys = Array.from(keysToQuery);

  // 3. Consultar trades existentes en la tabla maestra 'trades' (abiertos y catálogo histórico para no perder estrategias)
  const [{ data: openTradesInDb }, { data: allTradesInDb }] = await Promise.all([
    supabase
      .from('trades')
      .select('*')
      .ilike('status', 'Open'),
    supabase
      .from('trades')
      .select('trade_code, symbol, unique_key, instrument, strategy_id, stock_entry_price, status')
  ]);

  // Mapa global de todos los trades existentes para preservar estrategias y precios de entrada configurados
  const existingMasterByCode = new Map<number, any>();
  const existingMasterByKey = new Map<string, any>();
  for (const tr of (allTradesInDb || [])) {
    const code = Number(tr.trade_code);
    if (!isNaN(code) && code > 0) {
      existingMasterByCode.set(code, tr);
    }
    if (tr.unique_key) {
      existingMasterByKey.set(normalizeUniqueKey(tr.unique_key), tr);
    }
  }

  // 4. Clonar filas entrantes para procesarlas en orden cronológico
  const clonedRows = rows.map((r, idx) => ({ ...r, _origIdx: idx }));

  // 5. Construir mapa de trades abiertos EXCLUSIVAMENTE desde la tabla maestra 'trades'
  const combinedOpenTradesMap = new Map<number, any>();
  for (const tr of (openTradesInDb || [])) {
    const code = Number(tr.trade_code);
    if (!isNaN(code) && code > 0) {
      combinedOpenTradesMap.set(code, tr);
    }
  }

  const openTradesList: any[] = Array.from(combinedOpenTradesMap.values());
  const openTradeCodes = openTradesList
    .map(t => Number(t.trade_code))
    .filter(c => !isNaN(c) && c > 0);
  const existingDbCodes = new Set<number>(openTradeCodes);

  // 6. Obtener transacciones previas de esos trades abiertos para balance neto acumulado exacto
  const { data: existingOpenTxs } = openTradeCodes.length > 0
    ? await supabase
        .from('transactions')
        .select('trade_code, action, quantity, amount, instrument')
        .in('trade_code', openTradeCodes)
    : { data: [] };

  interface ActiveTradeState {
    trade: Partial<Trade>;
    netQty: number;
    hasTransactions: boolean;
  }

  const stateByCode = new Map<number, ActiveTradeState>();
  const activeOpenByKey = new Map<string, ActiveTradeState>();
  const activeOpenBySymbol = new Map<string, ActiveTradeState[]>();

  for (const tr of openTradesList) {
    const code = Number(tr.trade_code);
    if (isNaN(code) || code <= 0) continue;
    const { id: _id, created_at: _ca, updated_at: _ua, strategies: _st, ...cleanTr } = tr;
    const state: ActiveTradeState = {
      trade: { ...cleanTr },
      netQty: 0,
      hasTransactions: false
    };
    stateByCode.set(code, state);
    if (tr.unique_key) {
      activeOpenByKey.set(normalizeUniqueKey(tr.unique_key), state);
    }
    if (tr.symbol) {
      const sym = tr.symbol.trim().toUpperCase();
      if (!activeOpenBySymbol.has(sym)) {
        activeOpenBySymbol.set(sym, []);
      }
      activeOpenBySymbol.get(sym)!.push(state);
    }
  }

  for (const t of existingOpenTxs || []) {
    const code = Number(t.trade_code);
    const state = stateByCode.get(code);
    if (!state) continue;
    const act = (t.action || '').trim().toLowerCase();
    const rawQty = Number(t.quantity) || 0;
    const absQty = Math.abs(rawQty);
    const isExp = act.includes('exp');
    const delta = calcularDeltaQuantity(t.action, rawQty);
    state.hasTransactions = true;
    if (isExp) {
      state.netQty = absQty === 0 ? 0 : Math.max(0, state.netQty + delta);
    } else {
      state.netQty += delta;
    }
  }

  // 7. Ordenar las filas entrantes cronológicamente (compras antes que ventas en el mismo día)
  clonedRows.sort((a, b) => {
    const dateCmp = String(a.date || '').localeCompare(String(b.date || ''));
    if (dateCmp !== 0) return dateCmp;
    const actA = String(a.action || '').toLowerCase();
    const actB = String(b.action || '').toLowerCase();
    const isBuyA = actA.includes('buy') || actA.includes('bot') || actA.includes('bought') || (typeof a.amount === 'number' && a.amount < 0);
    const isBuyB = actB.includes('buy') || actB.includes('bot') || actB.includes('bought') || (typeof b.amount === 'number' && b.amount < 0);
    if (isBuyA !== isBuyB) return isBuyA ? -1 : 1;
    return a._origIdx - b._origIdx;
  });

  const tradesToUpsertMap = new Map<number, Partial<Trade>>();
  const existingCodesToClose = new Set<number>();
  const assignedTradeCodes = new Set<number>();
  const newTradeCodes = new Set<number>();

  for (const row of clonedRows) {
    const uKey = row.unique_key || row.symbol || 'UNKNOWN';
    const normUKey = normalizeUniqueKey(uKey);
    const act = (row.action || '').trim().toLowerCase();
    const rawQty = Number(row.quantity) || 0;
    const absQty = Math.abs(rawQty);
    const isExp = act.includes('exp');
    const delta = calcularDeltaQuantity(row.action, rawQty);
    const isSell = delta < 0;
    const isBuy = delta > 0;

    let code = row.trade_code && !isNaN(Number(row.trade_code)) && Number(row.trade_code) > 0
      ? Number(row.trade_code)
      : null;

    let activeState: ActiveTradeState | undefined;

    if (code !== null) {
      if (code >= nextTradeCode) {
        nextTradeCode = code + 1;
      }
      activeState = stateByCode.get(code);
      if (!activeState) {
        const masterExisting = (code !== null ? existingMasterByCode.get(code) : undefined) || existingMasterByKey.get(normUKey);
        const newTrade: Partial<Trade> = {
          trade_code: code,
          symbol: row.symbol || masterExisting?.symbol || uKey,
          unique_key: masterExisting?.unique_key || uKey,
          instrument: (row.instrument || masterExisting?.instrument || 'Stock') as 'Stock' | 'Option',
          strategy_id: row.strategy_id ?? masterExisting?.strategy_id ?? null,
          stock_entry_price: row.stock_entry_price ?? masterExisting?.stock_entry_price ?? (row.instrument === 'Stock' ? row.price : null),
          first_buy_date: row.date,
          status: 'Open',
          weekend_trader_flag: masterExisting?.weekend_trader_flag || false,
          account_id: row.account_id || defaultAccountId || null
        };
        activeState = {
          trade: newTrade,
          netQty: 0,
          hasTransactions: false
        };
        stateByCode.set(code, activeState);
        activeOpenByKey.set(normUKey, activeState);
        tradesToUpsertMap.set(code, newTrade);
      }
    } else {
      // 1. Buscar trade maestro 'Open' para este unique_key exacto o normalizado
      activeState = activeOpenByKey.get(normUKey) || activeOpenByKey.get(normalizeUniqueKey(uKey));

      // 2. Si no coincide por unique_key, buscar por symbol entre los trades 'Open'
      if (!activeState && row.symbol) {
        const symUpper = row.symbol.trim().toUpperCase();
        const candidateStates = activeOpenBySymbol.get(symUpper) || [];
        if (candidateStates.length === 1) {
          activeState = candidateStates[0];
        } else if (candidateStates.length > 1) {
          const rowInst = (row.instrument || 'Stock').toLowerCase();
          const withSameInst = candidateStates.find(s => (s.trade.instrument || 'Stock').toLowerCase() === rowInst);
          if (withSameInst) {
            activeState = withSameInst;
          } else if (isSell) {
            const withPositiveQty = candidateStates.find(s => s.netQty > 0);
            activeState = withPositiveQty || candidateStates[0];
          } else {
            activeState = candidateStates[0];
          }
        }
      }

      if (activeState && activeState.trade.trade_code) {
        code = Number(activeState.trade.trade_code);
        row.trade_code = code;
      } else {
        // No existe trade 'Open' para este unique_key ni para el símbolo -> generar nuevo trade_code en 'trades'
        code = nextTradeCode++;
        row.trade_code = code;

        const masterExisting = existingMasterByCode.get(code) || existingMasterByKey.get(normUKey);

        const newTrade: Partial<Trade> = {
          trade_code: code,
          symbol: row.symbol || masterExisting?.symbol || uKey,
          unique_key: masterExisting?.unique_key || uKey,
          instrument: (row.instrument || masterExisting?.instrument || 'Stock') as 'Stock' | 'Option',
          strategy_id: masterExisting?.strategy_id ?? null,
          stock_entry_price: masterExisting?.stock_entry_price ?? (row.instrument === 'Stock' ? row.price : null),
          first_buy_date: row.date,
          status: isSell ? 'Closed' : 'Open',
          weekend_trader_flag: masterExisting?.weekend_trader_flag || false,
          account_id: row.account_id || defaultAccountId || null
        };

        activeState = {
          trade: newTrade,
          netQty: 0,
          hasTransactions: false
        };
        stateByCode.set(code, activeState);
        activeOpenByKey.set(normUKey, activeState);
        if (newTrade.symbol) {
          const sym = newTrade.symbol.trim().toUpperCase();
          if (!activeOpenBySymbol.has(sym)) {
            activeOpenBySymbol.set(sym, []);
          }
          activeOpenBySymbol.get(sym)!.push(activeState);
        }
        tradesToUpsertMap.set(code, newTrade);

        // SOLO compras nuevas de trades sin estrategia previa se envían a revisión en Step 2 Modal
        if (isBuy && !masterExisting?.strategy_id) {
          newTradeCodes.add(code);
        }
      }
    }

    assignedTradeCodes.add(code);

    // Actualizar balance neto acumulado del trade_code
    activeState.hasTransactions = true;
    if (isExp) {
      activeState.netQty = absQty === 0 ? 0 : Math.max(0, activeState.netQty + delta);
    } else {
      activeState.netQty += delta;
    }

    const isTradeClosed = activeState.hasTransactions && Math.abs(activeState.netQty) <= 0.0001;
    activeState.trade.current_quantity = isTradeClosed ? 0 : Math.max(0, Number(activeState.netQty.toFixed(4)));

    if (isTradeClosed) {
      activeState.trade.status = 'Closed';
      activeOpenByKey.delete(normUKey);
      if (activeState.trade.unique_key) {
        activeOpenByKey.delete(normalizeUniqueKey(activeState.trade.unique_key));
      }
      if (activeState.trade.symbol) {
        const sym = activeState.trade.symbol.trim().toUpperCase();
        const list = activeOpenBySymbol.get(sym) || [];
        const remaining = list.filter(s => s.trade.trade_code !== code);
        if (remaining.length > 0) {
          activeOpenBySymbol.set(sym, remaining);
        } else {
          activeOpenBySymbol.delete(sym);
        }
      }
      if (existingDbCodes.has(code)) {
        existingCodesToClose.add(code);
      } else {
        tradesToUpsertMap.set(code, activeState.trade);
      }
    } else {
      activeState.trade.status = 'Open';
      if (existingDbCodes.has(code)) {
        existingCodesToClose.delete(code);
      }
    }
  }

  // 8. Persistir primero los registros maestros nuevos en 'trades' y cerrar los existentes que correspondan
  if (tradesToUpsertMap.size > 0) {
    await upsertTrades(supabase, Array.from(tradesToUpsertMap.values()));
  }
  if (existingCodesToClose.size > 0) {
    await supabase
      .from('trades')
      .update({ status: 'Closed', current_quantity: 0 })
      .in('trade_code', Array.from(existingCodesToClose));
  }

  // Restaurar el orden original de las filas con sus trade_code ya asignados
  clonedRows.sort((a, b) => a._origIdx - b._origIdx);
  const rowsWithCodes = clonedRows.map(({ _origIdx, ...rest }) => rest);

  return {
    rowsWithCodes,
    tradeCodes: Array.from(assignedTradeCodes),
    newTradeCodes: Array.from(newTradeCodes)
  };
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
      .select('*, strategies(name)')
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
    // REGLA CRÍTICA DE PROTECCIÓN: NUNCA eliminar trades de la tabla 'trades' si el usuario ya les asignó
    // estrategia (strategy_id) o precio de entrada (stock_entry_price), para preservar sus configuraciones ante rollbacks o re-subidas de CSV.
    const codesWithTxs = new Set(txsByCode.keys());
    const orphanCodes = uniqueCodes.filter(c => !codesWithTxs.has(c));
    const orphanCodesToDelete = orphanCodes.filter(c => {
      const ex = existingMap.get(c);
      return !ex || (ex.strategy_id === null && (ex.stock_entry_price === null || ex.stock_entry_price === 0));
    });
    if (orphanCodesToDelete.length > 0) {
      const { error: errDel } = await supabase.from('trades').delete().in('trade_code', orphanCodesToDelete);
      if (errDel) {
        console.warn('[syncTradesForCodes] Error deleting orphan trades from trades table:', errDel.message);
      }
    }

    // 3. Obtener cotizaciones de MK-TOS en lote para los símbolos que se van a cerrar
    const closedSymbols = Array.from(new Set(
      Array.from(txsByCode.entries())
        .filter(([_, codeTxs]) => calcularEstadoTradeDesdeTransacciones(codeTxs) === 'Closed')
        .map(([code, codeTxs]) => (existingMap.get(code)?.symbol || codeTxs[0]?.symbol || '').trim().toUpperCase())
        .filter(Boolean)
    ));

    const quotesBySymbol = new Map<string, any>();
    if (closedSymbols.length > 0) {
      try {
        const { data: quotes } = await supabase
          .from('mk_tos_quotes')
          .select('symbol, last_price, mac_stop, trendpilot_stop, low_52, low_100_day, ema, bollinger_bands, quote_date')
          .in('symbol', closedSymbols)
          .order('quote_date', { ascending: false });

        if (quotes) {
          for (const q of quotes) {
            const sym = (q.symbol || '').trim().toUpperCase();
            if (!quotesBySymbol.has(sym)) {
              quotesBySymbol.set(sym, q);
            }
          }
        }
      } catch (errQ: any) {
        console.warn('[syncTradesForCodes] Warning fetching quotes for exit metrics:', errQ.message);
      }
    }

    const tradesToUpsert: Partial<Trade>[] = [];

    for (const [code, codeTxs] of txsByCode.entries()) {
      const existing = existingMap.get(code);

      // Buscar primera compra cronológica
      const primeraCompra = codeTxs.find(t => 
        (t.amount !== null && t.amount !== undefined && t.amount < 0) ||
        (t.action && t.action.toLowerCase().includes('buy'))
      ) || codeTxs[0];

      const firstBuyDate = existing?.first_buy_date || primeraCompra?.date || codeTxs[0]?.date || null;
      const instrument = (existing?.instrument || primeraCompra?.instrument || codeTxs[0]?.instrument || 'Stock') as 'Stock' | 'Option';
      const initialEntryPrice = existing?.stock_entry_price ?? (instrument === 'Stock' ? primeraCompra?.price : null);
      const symbol = existing?.symbol || codeTxs[0]?.symbol || '';
      const uniqueKey = existing?.unique_key || codeTxs[0]?.unique_key || symbol;
      const accountId = existing?.account_id || codeTxs[0]?.account_id || defaultAccountId || null;

      const strategyId = existing?.strategy_id ?? null;

      // REGLA: Calcular estado ('Open' o 'Closed') y cantidad neta actual (current_quantity)
      const calculatedCurrentQty = calcularCurrentQuantityDesdeTransacciones(codeTxs);
      const calculatedStatus = calculatedCurrentQty > 0.0001 ? 'Open' : 'Closed';

      const normDateStr = firstBuyDate ? (parsearFechaTOS(firstBuyDate) || firstBuyDate.substring(0, 10)) : null;
      const isWeekendTrade = Boolean(
        ((existing?.strategies as any)?.name || '').toLowerCase().includes('weekend') ||
        codeTxs.some(t => {
          const sName = (t as any).strategies?.name || t.strategy || '';
          return sName.toLowerCase().includes('weekend');
        })
      );
      const isBeforeCutoff = Boolean(normDateStr && normDateStr < '2026-07-24');
      const initialWeekendFlag = isWeekendTrade && isBeforeCutoff;

      let closedDateFromTx: string | null = null;
      let exitPriceFromTx: number | null = null;
      let calculatedExitMetrics: { exit_price: number | null; exit_stop: number | null; exit_signal: number | null } = {
        exit_price: null,
        exit_stop: null,
        exit_signal: null
      };

      if (calculatedStatus === 'Closed') {
        const txsSell = codeTxs.filter(t => {
          const act = (t.action || '').trim().toLowerCase();
          return act.includes('sell') || act.includes('sold') || act.includes('exp') || (t.amount !== null && t.amount !== undefined && t.amount > 0);
        });
        const lastSellTx = txsSell.length > 0 ? txsSell[txsSell.length - 1] : codeTxs[codeTxs.length - 1];
        if (lastSellTx) {
          closedDateFromTx = parsearFechaTOS(lastSellTx.date) || lastSellTx.date.substring(0, 10);
          exitPriceFromTx = (lastSellTx.price && lastSellTx.price > 0) ? lastSellTx.price : null;
        }

        const quote = quotesBySymbol.get(symbol.trim().toUpperCase()) || null;
        const stratName = (existing?.strategies as any)?.name || '';
        calculatedExitMetrics = calculateStrategyExitMetrics(
          stratName,
          quote,
          existing?.stock_entry_price ?? initialEntryPrice,
          existing?.max_stock_price ?? null,
          existing?.ratchet_stop ?? null,
          existing?.weekend_trader_flag ?? initialWeekendFlag,
          exitPriceFromTx
        );
      }

      // Calcular cash_flow acumulado e initial_investment desde las transacciones del trade
      const totalCashFlow = Number(
        codeTxs.reduce((sum, t) => sum + (typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0), 0).toFixed(2)
      );
      let initialInvestment = 0;
      if (primeraCompra) {
        if (typeof primeraCompra.amount === 'number' && primeraCompra.amount !== 0) {
          initialInvestment = Number(Math.abs(primeraCompra.amount).toFixed(2));
        } else if (typeof primeraCompra.price === 'number' && typeof primeraCompra.quantity === 'number') {
          const mult = instrument === 'Option' ? 100 : 1;
          initialInvestment = Number(Math.abs(primeraCompra.price * primeraCompra.quantity * mult).toFixed(2));
        }
      }

      if (!existing) {
        tradesToUpsert.push({
          trade_code: code,
          symbol,
          unique_key: uniqueKey,
          instrument,
          strategy_id: strategyId,
          stock_entry_price: initialEntryPrice,
          first_buy_date: firstBuyDate,
          status: calculatedStatus,
          current_quantity: calculatedCurrentQty,
          weekend_trader_flag: calculatedStatus === 'Closed' ? false : initialWeekendFlag,
          max_stock_price: calculatedStatus === 'Closed' ? null : undefined,
          max_stock_price_date: calculatedStatus === 'Closed' ? null : undefined,
          closed_date: calculatedStatus === 'Closed' ? (closedDateFromTx || new Date().toISOString().substring(0, 10)) : undefined,
          exit_price: calculatedStatus === 'Closed' ? (calculatedExitMetrics.exit_price ?? exitPriceFromTx) : undefined,
          exit_stop: calculatedStatus === 'Closed' ? calculatedExitMetrics.exit_stop : undefined,
          exit_signal: calculatedStatus === 'Closed' ? calculatedExitMetrics.exit_signal : undefined,
          cash_flow: totalCashFlow,
          initial_investment: initialInvestment,
          realized_pnl: calculatedStatus === 'Closed' ? totalCashFlow : null,
          account_id: accountId
        });
      } else {
        const updateObj: Record<string, any> = {
          status: calculatedStatus,
          current_quantity: calculatedCurrentQty,
          symbol: existing.symbol || symbol,
          unique_key: existing.unique_key || uniqueKey,
          first_buy_date: existing.first_buy_date || firstBuyDate,
          stock_entry_price: existing.stock_entry_price ?? initialEntryPrice,
          cash_flow: totalCashFlow,
          initial_investment: initialInvestment > 0 ? initialInvestment : (existing.initial_investment ?? 0)
        };
        if (calculatedStatus === 'Closed') {
          updateObj.max_stock_price = null;
          updateObj.max_stock_price_date = null;
          updateObj.weekend_trader_flag = false;
          updateObj.closed_date = existing.closed_date || closedDateFromTx || new Date().toISOString().substring(0, 10);
          updateObj.exit_price = existing.exit_price ?? (calculatedExitMetrics.exit_price ?? exitPriceFromTx);
          updateObj.exit_stop = existing.exit_stop ?? calculatedExitMetrics.exit_stop;
          updateObj.exit_signal = existing.exit_signal ?? calculatedExitMetrics.exit_signal;
          updateObj.realized_pnl = totalCashFlow;
        } else {
          // Reversión explícita a Open: limpiar métricas y campos de cierre
          updateObj.closed_date = null;
          updateObj.exit_price = null;
          updateObj.exit_stop = null;
          updateObj.exit_signal = null;
          updateObj.realized_pnl = null;
          updateObj.weekend_trader_flag = isWeekendTrade && isBeforeCutoff;
        }

        const { error: errUp } = await supabase
          .from('trades')
          .update(updateObj)
          .eq('trade_code', code);

        if (errUp) {
          console.warn(`[syncTradesForCodes] Error updating trade ${code}:`, errUp.message);
        }
      }
    }

    if (tradesToUpsert.length > 0) {
      await upsertTrades(supabase, tradesToUpsert);
    }
  } catch (error: any) {
    console.warn('[syncTradesForCodes] Error en sincronización:', error.message);
  }
}

// 28b. Reconciliar el estado y métricas de todos los trades existentes en base a las transacciones
export async function reconcileAllTradesStatus(supabase: SupabaseClient): Promise<number> {
  try {
    // 1. Obtener todos los trade_codes de transactions
    const { data: txCodes, error: errTx } = await supabase
      .from('transactions')
      .select('trade_code');

    if (errTx) {
      console.warn('[reconcileAllTradesStatus] Error querying transactions:', errTx.message);
      return 0;
    }

    // 2. Obtener todos los trade_codes de trades
    const { data: tradeCodesData, error: errTr } = await supabase
      .from('trades')
      .select('trade_code');

    if (errTr) {
      console.warn('[reconcileAllTradesStatus] Error querying trades:', errTr.message);
      return 0;
    }

    const allCodes = Array.from(new Set([
      ...(txCodes || []).map((t: any) => Number(t.trade_code)),
      ...(tradeCodesData || []).map((t: any) => Number(t.trade_code))
    ])).filter(c => !isNaN(c) && c > 0);

    if (allCodes.length === 0) return 0;

    // Procesar en lotes de 100 para evitar límites de PostgREST
    const BATCH_SIZE = 100;
    for (let i = 0; i < allCodes.length; i += BATCH_SIZE) {
      const batch = allCodes.slice(i, i + BATCH_SIZE);
      await syncTradesForCodes(supabase, batch);
    }

    return allCodes.length;
  } catch (err: any) {
    console.warn('[reconcileAllTradesStatus] Error during reconciliation:', err.message);
    return 0;
  }
}

// 28c. Rellenar métricas de salida para trades cerrados que carecen de exit_stop o exit_price (ej: cuando se sube MK-TOS con posterioridad)
export async function backfillClosedTradesExitMetricsFromMkTos(
  supabase: SupabaseClient,
  symbols?: string[]
): Promise<number> {
  try {
    let query = supabase
      .from('trades')
      .select('trade_code, symbol, strategy_id, stock_entry_price, max_stock_price, ratchet_stop, weekend_trader_flag, exit_price, exit_stop, exit_signal, strategies(name)')
      .eq('status', 'Closed')
      .or('exit_stop.is.null,exit_price.is.null');

    if (symbols && symbols.length > 0) {
      query = query.in('symbol', symbols.map(s => s.trim().toUpperCase()));
    }

    const { data: tradesToEnrich, error } = await query;
    if (error || !tradesToEnrich || tradesToEnrich.length === 0) return 0;

    const uniqueSymbols = Array.from(new Set((tradesToEnrich as any[]).map((t: any) => (t.symbol || '').trim().toUpperCase()).filter(Boolean)));
    if (uniqueSymbols.length === 0) return 0;

    const { data: quotes } = await supabase
      .from('mk_tos_quotes')
      .select('symbol, last_price, mac_stop, trendpilot_stop, low_52, low_100_day, ema, bollinger_bands, quote_date')
      .in('symbol', uniqueSymbols)
      .order('quote_date', { ascending: false });

    const quotesBySymbol = new Map<string, any>();
    if (quotes) {
      for (const q of quotes) {
        const sym = (q.symbol || '').trim().toUpperCase();
        if (!quotesBySymbol.has(sym)) {
          quotesBySymbol.set(sym, q);
        }
      }
    }

    let updatedCount = 0;
    for (const tr of tradesToEnrich) {
      const quote = quotesBySymbol.get((tr.symbol || '').trim().toUpperCase());
      if (!quote) continue;

      const stratName = (tr.strategies as any)?.name || '';
      const metrics = calculateStrategyExitMetrics(
        stratName,
        quote,
        tr.stock_entry_price,
        tr.max_stock_price,
        tr.ratchet_stop,
        tr.weekend_trader_flag,
        tr.exit_price
      );

      const updates: Record<string, any> = {};
      if (tr.exit_stop === null || tr.exit_stop === undefined) {
        updates.exit_stop = metrics.exit_stop;
      }
      if (tr.exit_price === null || tr.exit_price === undefined) {
        updates.exit_price = metrics.exit_price;
      }
      if (tr.exit_signal === null || tr.exit_signal === undefined) {
        updates.exit_signal = metrics.exit_signal;
      }

      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await supabase
          .from('trades')
          .update(updates)
          .eq('trade_code', tr.trade_code);
        if (!upErr) updatedCount++;
      }
    }

    return updatedCount;
  } catch (err: any) {
    console.warn('[backfillClosedTradesExitMetricsFromMkTos] Error:', err.message);
    return 0;
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

// 32. Obtener todas las transacciones paginadas para cálculos analíticos del Dashboard
export async function getAllTransactions(supabase: SupabaseClient): Promise<Transaction[]> {
  const pageSize = 1000;
  const allTxs: Transaction[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: true })
      .range(from, to);

    if (error) {
      console.warn('[getAllTransactions] Warning fetching transactions:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allTxs.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  return allTxs;
}

// Cache en memoria para evitar descargar repetidamente el mismo archivo de posiciones
let memoryCashCache: { storagePath: string; cash: number } | null = null;

// Obtener el saldo en efectivo actual ('Cash & Sweep Vehicle') del último archivo Position Statement cargado
export async function getLatestPositionsCashBalance(supabase: SupabaseClient): Promise<number> {
  try {
    const { data: latestFile, error } = await supabase
      .from('file_uploads')
      .select('storage_path')
      .eq('module', 'positions')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !latestFile?.storage_path) {
      return 0;
    }

    if (memoryCashCache && memoryCashCache.storagePath === latestFile.storage_path) {
      return memoryCashCache.cash;
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from('Positions')
      .download(latestFile.storage_path);

    if (downloadError || !blob) {
      return 0;
    }

    const text = await blob.text();
    const cash = extraerCashBalanceDesdeCsv(text);
    memoryCashCache = { storagePath: latestFile.storage_path, cash };
    return cash;
  } catch {
    return 0;
  }
}

// 33. Cargar todos los orígenes de datos requeridos por el Centro de Control Ejecutivo del Dashboard
export async function getDashboardExecutiveSourceData(supabase: SupabaseClient): Promise<{
  positions: Position[];
  transactions: Transaction[];
  strategies: Strategy[];
  trades: Trade[];
  cashBalance: number;
}> {
  const [positions, transactions, strategies, trades, cashBalance] = await Promise.all([
    getPositions(supabase).catch(() => []),
    getAllTransactions(supabase).catch(() => []),
    getActiveStrategies(supabase).catch(() => []),
    getTrades(supabase).catch(() => []),
    getLatestPositionsCashBalance(supabase).catch(() => 0)
  ]);

  return {
    positions,
    transactions,
    strategies,
    trades,
    cashBalance
  };
}


// 34. Cargar todos los orígenes de datos consolidados requeridos por Strategies Stops y Portfolio Risk
export async function getConsolidatedTradingSourceData(supabase: SupabaseClient): Promise<{
  positions: Position[];
  transactions: Transaction[];
  mkTosQuotes: MkTosQuote[];
  trades: Trade[];
  strategies: Strategy[];
  spyCloses: SpyDailyClose[];
}> {
  const [positions, openTrades, activeStrategies, spyCloses] = await Promise.all([
    getPositions(supabase).catch(() => []),
    getOpenTrades(supabase).catch(() => []),
    getActiveStrategies(supabase).catch(() => []),
    getSpyDailyCloses(supabase).catch(() => [])
  ]);

  if (!positions || positions.length === 0) {
    return {
      positions: [],
      transactions: [],
      mkTosQuotes: [],
      trades: openTrades || [],
      strategies: activeStrategies || [],
      spyCloses: spyCloses || []
    };
  }

  const uniqueKeys = positions.map(p => p.unique_key).filter(Boolean);
  const keysToQuery = new Set<string>();
  for (const k of uniqueKeys) {
    keysToQuery.add(k);
    const match = k.trim().match(/^([A-Z]+)-(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/);
    if (match) {
      const ticker = match[1];
      const p1 = match[2].padStart(2, '0');
      const p2 = match[3].padStart(2, '0');
      const yyyy = match[4];
      const rest = match[5];
      keysToQuery.add(`${ticker}-${p2}/${p1}/${yyyy} ${rest}`);
    }
  }

  const symbols = Array.from(new Set([...positions.map(p => p.symbol).filter(Boolean), 'SPY']));
  const prefetchedCodes = Array.from(new Set(
    (openTrades || [])
      .map(t => Number(t.trade_code))
      .filter(c => !isNaN(c) && c > 0)
  ));

  const [initialTxs, mkTosQuotes, prefetchedTxs] = await Promise.all([
    getTransactionsByUniqueKeys(supabase, Array.from(keysToQuery)).catch(() => []),
    getLatestMkTosQuotes(supabase, symbols).catch(() => []),
    getTransactionsByTradeCodes(supabase, prefetchedCodes).catch(() => [])
  ]);

  const txMap = new Map<string, Transaction>();
  for (const t of initialTxs || []) {
    txMap.set(t.id, t);
  }
  for (const t of prefetchedTxs || []) {
    txMap.set(t.id, t);
  }

  return {
    positions,
    transactions: Array.from(txMap.values()),
    mkTosQuotes: mkTosQuotes || [],
    trades: openTrades || [],
    strategies: activeStrategies || [],
    spyCloses: spyCloses || []
  };
}

export const getPortfolioRiskSourceData = getConsolidatedTradingSourceData;

// 34b. Cargar todos los orígenes de datos requeridos por el módulo Hedging & Marian Shield
export async function getHedgingSourceData(supabase: SupabaseClient): Promise<{
  positions: Position[];
  transactions: Transaction[];
  mkTosQuotes: MkTosQuote[];
  trades: Trade[];
  strategies: Strategy[];
  spyCloses: SpyDailyClose[];
  cashBalance: number;
}> {
  const [consolidatedData, cashBalance] = await Promise.all([
    getConsolidatedTradingSourceData(supabase),
    getLatestPositionsCashBalance(supabase).catch(() => 0)
  ]);

  return {
    ...consolidatedData,
    cashBalance
  };
}

// 40. Obtener trades nuevos o afectados que requieren revisión y enriquecimiento (strategy / stock_entry_price)
export async function getTradesForEnrichment(
  supabase: SupabaseClient,
  tradeCodes: number[]
): Promise<TradeEnrichmentItem[]> {
  const uniqueCodes = Array.from(new Set(tradeCodes.filter(c => !isNaN(c) && c > 0)));
  if (uniqueCodes.length === 0) return [];

  // 1. Obtener trades desde la tabla maestra que estén ABIERTOS ('Open')
  const { data: trades, error: errTrades } = await supabase
    .from('trades')
    .select('*')
    .in('trade_code', uniqueCodes)
    .ilike('status', 'Open');

  if (errTrades || !trades || trades.length === 0) return [];

  // Filtrar solo los trades que realmente necesitan revisión:
  // - No tienen strategy_id asignado, O
  // - No tienen stock_entry_price asignado o es 0
  const pendingTrades = trades.filter((tr: any) => 
    tr.strategy_id === null || 
    tr.strategy_id === undefined || 
    tr.stock_entry_price === null || 
    tr.stock_entry_price === undefined ||
    tr.stock_entry_price === 0
  );

  if (pendingTrades.length === 0) return [];

  // 2. Obtener transacciones vinculadas para inferir el tipo de instrumento (Stock u Option) y primera compra
  const pendingCodes = pendingTrades.map((t: any) => Number(t.trade_code));
  const { data: txs } = await supabase
    .from('transactions')
    .select('trade_code, symbol, instrument, price, amount, action, date')
    .in('trade_code', pendingCodes)
    .order('date', { ascending: true });

  const txsByCode = new Map<number, any[]>();
  for (const t of (txs || [])) {
    const code = Number(t.trade_code);
    if (!txsByCode.has(code)) txsByCode.set(code, []);
    txsByCode.get(code)!.push(t);
  }

  // 3. Buscar precios sugeridos recientes en mk_tos_quotes
  const symbols: string[] = Array.from(new Set<string>(
    pendingTrades
      .map((t: any) => (t.symbol ? String(t.symbol) : ''))
      .filter((s: string) => s.length > 0)
  ));
  const latestQuotes = symbols.length > 0 ? await getLatestMkTosQuotes(supabase, symbols).catch(() => []) : [];
  const quoteMap = new Map<string, number>();
  for (const q of latestQuotes) {
    if (q.symbol && q.last_price && !quoteMap.has(q.symbol)) {
      quoteMap.set(q.symbol, q.last_price);
    }
  }

  const items: TradeEnrichmentItem[] = [];
  for (const tr of pendingTrades) {
    const code = Number(tr.trade_code);
    const codeTxs = txsByCode.get(code) || [];
    const primeraCompra = codeTxs.find(t => 
      (t.amount !== null && t.amount !== undefined && t.amount < 0) ||
      (t.action && t.action.toLowerCase().includes('buy'))
    ) || codeTxs[0];

    const resolvedInstrument = tr.instrument || primeraCompra?.instrument || (tr.unique_key && (tr.unique_key.endsWith(' C') || tr.unique_key.endsWith(' P')) ? 'Option' : 'Stock');
    const isStock = resolvedInstrument === 'Stock';
    const instrument: 'Stock' | 'Option' = isStock ? 'Stock' : 'Option';
    const suggestedPrice = quoteMap.get(tr.symbol) ?? null;

    let stockEntryPrice = tr.stock_entry_price;
    if (isStock && (stockEntryPrice === null || stockEntryPrice === 0)) {
      stockEntryPrice = primeraCompra?.price ?? null;
    } else if (!isStock && (stockEntryPrice === null || stockEntryPrice === 0) && suggestedPrice) {
      stockEntryPrice = suggestedPrice;
    }

    items.push({
      trade_code: code,
      symbol: tr.symbol,
      instrument,
      strategy_id: tr.strategy_id ?? null,
      stock_entry_price: stockEntryPrice ?? null,
      is_stock: isStock,
      suggested_price: suggestedPrice
    });
  }

  return items.sort((a, b) => a.trade_code - b.trade_code);
}

// 41. Guardar masivamente enriquecimientos de trades (estrategias y precios de entrada)
export async function batchUpdateTradesEnrichment(
  supabase: SupabaseClient,
  items: { trade_code: number; strategy_id: number | null; stock_entry_price: number | null }[]
): Promise<void> {
  if (!items || items.length === 0) return;

  const tradeCodesToSync: number[] = [];

  for (const item of items) {
    const { trade_code, strategy_id, stock_entry_price } = item;
    if (!trade_code || isNaN(trade_code)) continue;

    tradeCodesToSync.push(trade_code);

    // 1. Actualizar tabla maestra trades
    await updateTradeField(supabase, trade_code, 'strategy_id', strategy_id);
    await updateTradeField(supabase, trade_code, 'stock_entry_price', stock_entry_price);

    // 2. Propagar a transacciones asociadas
    if (strategy_id !== undefined) {
      await updateTransactionsByTradeCode(supabase, trade_code, 'strategy_id', strategy_id).catch(() => {});
    }
    if (stock_entry_price !== undefined) {
      await updateTransactionsByTradeCode(supabase, trade_code, 'stock_entry_price', stock_entry_price).catch(() => {});
    }
  }

  // 3. Sincronizar trades para recalcular flags y consistencia
  if (tradeCodesToSync.length > 0) {
    await syncTradesForCodes(supabase, tradeCodesToSync).catch(() => {});
  }
}



