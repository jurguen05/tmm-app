// services/queries.ts

import { Transaction, Strategy, Profile, Position, FileUpload, MkTosQuote, Trade } from '../types';
import { calcularEstadoTradeDesdeTransacciones } from '../lib/transactionsParser';
import { parsearFechaTOS } from '../lib/formatters';

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

// 2. Obtener las transacciones iniciales (primeras 1000) vinculadas con la tabla maestra trades
export async function getTransactions(supabase: SupabaseClient, limit = 1000): Promise<Transaction[]> {
  const [txRes, tradesRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, strategies(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('trades')
      .select('*, strategies(name)')
  ]);
    
  if (txRes.error) throw new Error(txRes.error.message);
  const txs: Transaction[] = txRes.data || [];
  const trades: Trade[] = tradesRes.data || [];

  if (trades.length === 0) return txs;

  const tradesMap = new Map<number, Trade>();
  for (const tr of trades) {
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

// 2b. Buscar transacciones en el servidor filtradas por código, símbolo, estrategia o estado (sin límite de 1000)
export async function getFilteredTransactions(
  supabase: SupabaseClient,
  filters: { trade_code?: string; symbol?: string; strategy?: string; status?: string }
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*, strategies(name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

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
    query = query.ilike('position_status', filters.status.trim());
  }

  const [txRes, tradesRes] = await Promise.all([
    query,
    supabase
      .from('trades')
      .select('*, strategies(name)')
  ]);

  if (txRes.error) throw new Error(txRes.error.message);
  let txs: Transaction[] = txRes.data || [];
  const trades: Trade[] = tradesRes.data || [];

  const tradesMap = new Map<number, Trade>();
  for (const tr of trades) {
    if (tr.trade_code !== null && tr.trade_code !== undefined && !isNaN(Number(tr.trade_code))) {
      tradesMap.set(Number(tr.trade_code), tr);
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

  if (filters.strategy && filters.strategy.trim() && filters.strategy !== 'All') {
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

// 21. Obtener cotizaciones vigentes de MK-TOS (opcionalmente filtradas por símbolos)
export async function getLatestMkTosQuotes(
  supabase: SupabaseClient,
  symbols?: string[]
): Promise<MkTosQuote[]> {
  let query = supabase
    .from('mk_tos_quotes')
    .select('*, file_uploads!inner(is_archived)')
    .eq('file_uploads.is_archived', false)
    .order('quote_date', { ascending: false });

  if (symbols && symbols.length > 0) {
    query = query.in('symbol', symbols);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
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
): Promise<void> {
  if (!items || items.length === 0) return;
  for (const item of items) {
    try {
      const payload: any = {
        max_stock_price: item.max_stock_price,
        max_stock_price_date: item.max_stock_price_date
      };
      if (item.weekend_trader_flag === true) {
        payload.weekend_trader_flag = true;
      }
      await supabase
        .from('trades')
        .update(payload)
        .eq('trade_code', item.trade_code)
        .eq('status', 'Open');
    } catch {
      // Fallback seguro si la columna aún no está creada en DB
    }
  }
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


