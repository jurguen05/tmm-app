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
  position_status: 'Open' | 'Closed';
  strategy_id: number | null;
  stock_entry_price: number | null;
  file_upload_id?: string;
  description?: string | null;
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

    const rawStatus = (row['position_status'] || row['status'] || 'Open').toString().trim();
    const positionStatus: 'Open' | 'Closed' = rawStatus.toLowerCase() === 'closed' ? 'Closed' : 'Open';

    const rawPrice = normalizeNumber(row['Price'] || row['price']);
    const rawQty = (row['Quantity'] || row['quantity']) 
      ? Math.abs(parseFloat((row['Quantity'] || row['quantity']).toString().replace(/[^0-9.-]+/g, ''))) 
      : 0;

    const stockEntryPrice = instrument === 'Stock' 
      ? rawPrice 
      : (row['stock_entry_price'] ? normalizeNumber(row['stock_entry_price']) : null);

    const fila: ParsedTransactionRow = {
      account_id: accountId,
      trade_code: finalTradeCode,
      date: realDate,
      action: row['Action'] || row['action'] || '',
      symbol: symbol,
      instrument: instrument,
      unique_key: uniqueKey,
      quantity: isNaN(rawQty) ? 0 : rawQty,
      price: rawPrice,
      fees: normalizeNumber(row['Fees & Comm'] || row['fees'] || row['Fees']),
      amount: normalizeNumber(row['Amount'] || row['amount']),
      position_status: positionStatus,
      strategy_id: row['strategy_id'] ? parseInt(row['strategy_id'], 10) : null,
      stock_entry_price: stockEntryPrice,
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
 * Calcula el estado de un trade ('Open' o 'Closed') a partir del balance neto de sus transacciones (Opción 1).
 * Si la cantidad neta de acciones u opciones remanentes es 0, el trade está 'Closed'.
 * Si aún queda posición abierta en acciones u opciones, el trade permanece 'Open'.
 */
export const calcularEstadoTradeDesdeTransacciones = (transacciones: any[]): 'Open' | 'Closed' => {
  if (!transacciones || transacciones.length === 0) return 'Closed';

  let netStock = 0;
  let hasStock = false;
  let netOption = 0;
  let hasOption = false;

  for (const t of transacciones) {
    const act = (t.action || '').trim().toLowerCase();
    const qty = Math.abs(t.quantity || 0);

    const isBuy = act.includes('buy') || act.includes('bot') || act.includes('bought') || (t.amount !== null && t.amount !== undefined && t.amount < 0);
    const isSell = act.includes('sell') || act.includes('sold') || (t.amount !== null && t.amount !== undefined && t.amount > 0);

    const delta = isBuy ? qty : (isSell ? -qty : 0);

    if (t.instrument === 'Option') {
      hasOption = true;
      netOption += delta;
    } else {
      hasStock = true;
      netStock += delta;
    }
  }

  // Si tiene posición en acciones y el balance no es cero -> sigue Abierto
  if (hasStock && Math.abs(netStock) > 0.0001) {
    return 'Open';
  }

  // Si tiene posición en opciones y el balance no es cero -> sigue Abierto
  if (hasOption && Math.abs(netOption) > 0.0001) {
    return 'Open';
  }

  // Si no queda posición remanente en ningún instrumento -> Cerrado
  return 'Closed';
};
