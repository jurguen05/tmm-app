// lib/transactionsParser.ts

import { normalizeNumber, parsearFechaTOS } from './formatters';

export interface ParsedTransactionRow {
  account_id: string;
  trade_code: number | null;
  date: string;
  action: string;
  symbol: string;
  instrument: 'Stock' | 'Option';
  unique_key: string;
  quantity: number;
  price: number;
  fees: number;
  amount: number;
  file_upload_id?: string;
  description?: string | null;
  _isExistingDuplicate?: boolean;
  _origIdx?: number;
}

/**
 * Parsea un conjunto de filas brutas provenientes del CSV de Transacciones de ThinkorSwim.
 * Maneja tanto acciones ordinarias (Stock) como opciones (Option con strike, vencimiento y CALL/PUT).
 */
export const procesarFilasTransacciones = (
  csvData: any[],
  accountId: string,
  fileUploadId?: string
): ParsedTransactionRow[] => {
  const filasProcesadas: ParsedTransactionRow[] = [];

  for (const row of csvData) {
    const symbolOriginal = row['Symbol'] || row['symbol'];
    if (!symbolOriginal) continue;

    let uniqueKey = '';
    let symbol = '';
    let instrument: 'Stock' | 'Option' = 'Stock';

    // Formato de opciones de ThinkorSwim: "TICKER MM/DD/YYYY STRIKE C|P" o "TICKER DD/MM/YYYY STRIKE C|P"
    const optionMatch = symbolOriginal.match(/^([A-Z]+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d+(\.\d+)?)\s+([CP])$/);

    if (optionMatch) {
      const ticker = optionMatch[1];
      const parts = optionMatch[2].split('/');
      let mm = parts[0].padStart(2, '0');
      let dd = parts[1].padStart(2, '0');
      if (parseInt(parts[0], 10) > 12 && parseInt(parts[1], 10) <= 12) {
        dd = parts[0].padStart(2, '0');
        mm = parts[1].padStart(2, '0');
      }
      const expiry = `${mm}/${dd}/${parts[2]}`;
      const strike = parseFloat(optionMatch[3]);
      const type = optionMatch[5];
      uniqueKey = `${ticker}-${expiry} ${strike} ${type}`;
      symbol = ticker;
      instrument = 'Option';
    } else {
      uniqueKey = row['unique_key'] || symbolOriginal;
      symbol = row['symbol'] || symbolOriginal;
      instrument = (row['Instrument'] || row['instrument'] || 'Stock') as 'Stock' | 'Option';
    }

    const realDate = parsearFechaTOS(row['Date'] || row['date']);
    if (!realDate) continue;

    const rawCode = row['trade_code'] || row['codigo'];
    const parsedCode = rawCode ? parseInt(rawCode.toString().replace(/[^0-9.-]+/g, ''), 10) : null;
    const finalTradeCode = parsedCode !== null && !isNaN(parsedCode) ? parsedCode : null;

    const rawPrice = normalizeNumber(row['Price'] || row['price']);
    const parsedQty = (row['Quantity'] || row['quantity'])
      ? parseFloat((row['Quantity'] || row['quantity']).toString().replace(/[^0-9.-]+/g, ''))
      : 0;
    const actLower = String(row['Action'] || row['action'] || '').trim().toLowerCase();
    const isStandardBuyOrSell =
      actLower.includes('buy') ||
      actLower.includes('bot') ||
      actLower.includes('bought') ||
      actLower.includes('sell') ||
      actLower.includes('sold') ||
      actLower.includes('exp');
    // Para compras/ventas estándar se guarda magnitud positiva; para líneas de fusión/reorg sin Buy/Sell se preserva el signo (+/-)
    const rawQty = isNaN(parsedQty) ? 0 : (isStandardBuyOrSell ? Math.abs(parsedQty) : parsedQty);

    const fila: ParsedTransactionRow = {
      account_id: accountId,
      trade_code: finalTradeCode,
      date: realDate,
      action: row['Action'] || row['action'] || '',
      symbol: symbol,
      instrument: instrument,
      unique_key: uniqueKey,
      quantity: rawQty,
      price: rawPrice,
      fees: normalizeNumber(row['Fees & Comm'] || row['fees'] || row['Fees']),
      amount: normalizeNumber(row['Amount'] || row['amount']),
      description: row['description'] || row['Description'] || null
    };

    if (fileUploadId) {
      fila.file_upload_id = fileUploadId;
    }

    filasProcesadas.push(fila);
  }

  return filasProcesadas;
};

/**
 * Limpia y prepara el contenido de texto CSV antes de ser procesado por PapaParse.
 * - Remueve BOM (Byte Order Mark) de UTF-8 si está presente.
 * - Quita comillas envolventes anidadas solo cuando toda la línea viene como una celda
 *   única de exportación (ej: """...""") y no cuando es un CSV estándar con columnas
 *   entrecomilladas (donde los campos válidos están separados por '","').
 */
export const limpiarTextoCsv = (csvText: string): string => {
  if (!csvText) return '';
  const sinBom = csvText.replace(/^\uFEFF/, '');
  const lineas = sinBom.split(/\r?\n/);
  const lineasLimpias = lineas.map(linea => {
    let l = linea.trim();
    if (l.startsWith('"""') && l.endsWith('"""')) {
      l = l.substring(1, l.length - 1).replace(/""/g, '"');
    } else if (l.startsWith('"') && l.endsWith('"') && l.includes('""') && !l.includes('","')) {
      l = l.substring(1, l.length - 1).replace(/""/g, '"');
    }
    return l;
  });
  return lineasLimpias.join('\n');
};

/**
 * Extrae el código de cuenta desde el nombre del archivo (ej: "Individual_XXX784_Transactions...csv" -> "XXX784")
 */
export const extraerAccountIdDesdeNombre = (fileName: string, fallback = 'DESCONOCIDO'): string => {
  // 1. Formato estándar ThinkorSwim: "Individual_XXX784_Transactions_..." o "Individual_12345678_..."
  const tosMatch = fileName.match(/Individual_([A-Za-z0-9_]+?)_/i);
  if (tosMatch) return tosMatch[1].toUpperCase();

  // 2. Patrón común de 3 letras + 3 números (ej: "XXX784")
  const matchAccount = fileName.match(/([A-Z]{3}\d{3})/i);
  if (matchAccount) return matchAccount[1].toUpperCase();

  // 3. Prefijo al inicio del archivo (ej: "ACC123_transactions.csv")
  const prefixMatch = fileName.match(/^([A-Za-z0-9]+)[-_]/);
  if (prefixMatch) return prefixMatch[1].toUpperCase();

  return fallback;
};

/**
 * Determina el delta (+ o -) de la cantidad de una transacción según su Action:
 * - Buy to Open: +
 * - Buy: +
 * - Sell to Open: +
 * - Sell to Close: -
 * - Expired: -
 * - Sell: -
 * - Buy to Close: -
 */
export const calcularDeltaQuantity = (action: string | undefined | null, rawQty: number): number => {
  const act = (action || '').trim().toLowerCase();
  const absQty = Math.abs(rawQty);

  if (act.includes('buy to close') || act.includes('btc')) {
    return -absQty;
  }
  if (act.includes('sell to open') || act.includes('sto')) {
    return absQty;
  }
  if (act.includes('buy to open') || act.includes('bto')) {
    return absQty;
  }
  if (act.includes('sell to close') || act.includes('stc')) {
    return -absQty;
  }
  if (act.includes('exp')) {
    return -absQty;
  }
  if (act.includes('sell') || act.includes('sold')) {
    return -absQty;
  }
  if (act.includes('buy') || act.includes('bot') || act.includes('bought')) {
    return absQty;
  }

  if (rawQty < 0) return -absQty;
  if (rawQty > 0) return absQty;
  return 0;
};

/**
 * Calcula la cantidad neta actual de un trade (current_quantity) sumando y restando
 * las cantidades de todas las transacciones del trade_code de manera unificada.
 * Devuelve 0 si la posición está totalmente liquidada/cerrada.
 */
export const calcularCurrentQuantityDesdeTransacciones = (transacciones: any[]): number => {
  if (!transacciones || transacciones.length === 0) return 0;

  // Ordenar siempre cronológicamente de forma ascendente (más antiguo primero)
  const sorted = [...transacciones].sort((a, b) => {
    const dateA = String(a.date || '');
    const dateB = String(b.date || '');
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const actA = String(a.action || '').toLowerCase();
    const actB = String(b.action || '').toLowerCase();
    const isCloseA = actA.includes('sell') || actA.includes('exp') || actA.includes('close');
    const isCloseB = actB.includes('sell') || actB.includes('exp') || actB.includes('close');
    if (!isCloseA && isCloseB) return -1;
    if (isCloseA && !isCloseB) return 1;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  let netQty = 0;

  for (const t of sorted) {
    const rawQty = Number(t.quantity) || 0;
    const delta = calcularDeltaQuantity(t.action, rawQty);
    const act = (t.action || '').trim().toLowerCase();
    const isExp = act.includes('exp');

    if (isExp) {
      netQty = Math.abs(rawQty) === 0 ? 0 : Math.max(0, netQty + delta);
    } else {
      netQty += delta;
    }
  }

  return Math.abs(netQty) <= 0.0001 ? 0 : Number(Math.max(0, netQty).toFixed(4));
};

/**
 * Calcula el estado de un trade ('Open' o 'Closed') evaluando si su cantidad neta
 * acumulada es mayor a cero.
 */
export const calcularEstadoTradeDesdeTransacciones = (transacciones: any[]): 'Open' | 'Closed' => {
  const currentQty = calcularCurrentQuantityDesdeTransacciones(transacciones);
  return currentQty > 0.0001 ? 'Open' : 'Closed';
};


