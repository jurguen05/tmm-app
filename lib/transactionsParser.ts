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
  strategy: string | null;
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

    // Formato de opciones de ThinkorSwim: "TICKER DD/MM/YYYY STRIKE C|P" o "TICKER MM/DD/YYYY STRIKE C|P"
    const optionMatch = symbolOriginal.match(/^([A-Z]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+(\.\d+)?)\s+([CP])$/);

    if (optionMatch) {
      const ticker = optionMatch[1];
      const parts = optionMatch[2].split('/');
      // Invertir DD/MM a MM/DD para estandarizar la clave única si es necesario
      const expiry = `${parts[1]}/${parts[0]}/${parts[2]}`;
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
      strategy: row['strategy'] || null,
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
 * Limpia y prepara el contenido de texto CSV con comillas anidadas antes de ser procesado por PapaParse
 */
export const limpiarTextoCsv = (csvText: string): string => {
  const lineas = csvText.split('\n');
  const lineasLimpias = lineas.map(linea => {
    let l = linea.trim();
    if (l.startsWith('"') && l.endsWith('"')) {
      l = l.substring(1, l.length - 1).replace(/""/g, '"');
    }
    return l;
  });
  return lineasLimpias.join('\n');
};

/**
 * Extrae el código de cuenta desde el nombre del archivo (ej: "ABC123_transactions.csv" -> "ABC123")
 */
export const extraerAccountIdDesdeNombre = (fileName: string, fallback = 'DESCONOCIDO'): string => {
  const matchAccount = fileName.match(/([A-Z]{3}\d{3})/i);
  return matchAccount ? matchAccount[1].toUpperCase() : fallback;
};
