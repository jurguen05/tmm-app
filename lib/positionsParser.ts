// lib/positionsParser.ts

import { normalizeNumber } from './formatters';

export interface ParsedPositionRow {
  statement_date: string;
  unique_key: string;
  symbol: string;
  quantity: number;
  days: number;
  trade_price: number;
  stock_mark: number;
  stock_last: number;
  delta_position: number;
  theta: number;
  option_delta: number;
  option_theta: number;
  net_liq: number;
  file_upload_id?: string;
}

/**
 * Extrae el saldo en efectivo de la cuenta ('Cash & Sweep Vehicle')
 * ubicado al pie del archivo PositionStatement.csv de ThinkorSwim.
 */
export const extraerCashBalanceDesdeCsv = (csvText: string): number => {
  if (!csvText) return 0;
  const lines = csvText.split(/\r?\n/);
  for (const line of lines) {
    if (line.toLowerCase().includes('cash & sweep')) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const valPart = parts.slice(1).join(',');
        return normalizeNumber(valPart);
      }
    }
  }
  return 0;
};


export const procesarFilasPosiciones = (
  csvData: any[],
  statementDate: string,
  fileUploadId?: string
): ParsedPositionRow[] => {
  const filasProcesadas: ParsedPositionRow[] = [];
  
  const monthMap: Record<string, string> = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
    'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };

  let currentTicker = ''; 
  let currentStockMark = 0;
  let currentStockLast = 0;
  let tickerHasStockPosition = false;

  for (const row of csvData) {
    const symbolOriginal = row['Instrument'];
    
    if (!symbolOriginal || symbolOriginal.includes('Group') || symbolOriginal.includes('Equities') || symbolOriginal.includes('OVERALL P/L')) continue;

    let uniqueKey = '';
    let symbol = '';
    let isHeaderRow = false; 
    let isOption = false;

    if (!symbolOriginal.includes(' ')) {
      currentTicker = symbolOriginal;
      uniqueKey = currentTicker;
      symbol = currentTicker;
      tickerHasStockPosition = false;
      
      const rowLast = normalizeNumber(row['Last']);
      const rowMark = normalizeNumber(row['Mark']);
      currentStockLast = rowLast > 0 ? rowLast : 0;
      currentStockMark = rowMark > 0 ? rowMark : (rowLast > 0 ? rowLast : 0);

      const rawQty = (row['Qty'] || '').trim();
      if (!rawQty) {
        isHeaderRow = true; 
      } else {
        tickerHasStockPosition = true;
      }
    } else {
      const optionMatch = symbolOriginal.match(/^(\d+)\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{2})\s+(\d+(\.\d+)?)\s+(CALL|PUT)$/);
      
      if (optionMatch) {
        isOption = true;
        const day = optionMatch[2].padStart(2, '0');
        const mm = monthMap[optionMatch[3]];
        const yyyy = "20" + optionMatch[4];
        const strike = parseFloat(optionMatch[5]);
        const type = optionMatch[7] === 'CALL' ? 'C' : 'P';
        
        uniqueKey = `${currentTicker}-${mm}/${day}/${yyyy} ${strike} ${type}`;
        symbol = currentTicker;
      } else {
        // Fila descriptiva (nombre de empresa, ej: "AVANTOR INC" o "PERMIAN RES CORP A")
        const rowLast = normalizeNumber(row['Last']);
        const rowMark = normalizeNumber(row['Mark']);
        if (rowLast > 0) currentStockLast = rowLast;
        if (rowMark > 0) currentStockMark = rowMark;

        const rowQty = normalizeNumber(row['Qty']);
        const rowNetLiq = normalizeNumber(row['Net Liq']);

        // Si la fila del ticker original no trajo Qty (fue header agrupador de Thinkorswim),
        // pero esta fila descriptiva sí tiene Qty y Net Liq, representa la tenencia real de la acción.
        if (!tickerHasStockPosition && rowQty !== 0 && rowNetLiq !== 0 && currentTicker) {
          tickerHasStockPosition = true;
          uniqueKey = currentTicker;
          symbol = currentTicker;
        } else {
          continue; 
        }
      }
    }

    if (!isHeaderRow) {
      const qty = normalizeNumber(row['Qty']);
      const netLiq = normalizeNumber(row['Net Liq']);

      // Ignoramos filas con cantidad 0 o Net Liq 0
      if (qty === 0 || netLiq === 0) {
        continue;
      }

      // Si es una opción, usamos el Mark y Last de la acción subyacente
      const stockMark = isOption && currentStockMark > 0 ? currentStockMark : normalizeNumber(row['Mark']);
      const stockLast = isOption && currentStockLast > 0 ? currentStockLast : normalizeNumber(row['Last']);

      const fila: ParsedPositionRow = {
        statement_date: statementDate,
        unique_key: uniqueKey,
        symbol: symbol,
        quantity: qty,
        days: normalizeNumber(row['Days']),
        trade_price: normalizeNumber(row['Trade Price']),
        stock_mark: stockMark,
        stock_last: stockLast,
        delta_position: normalizeNumber(row['Delta']),
        theta: normalizeNumber(row['Theta']),
        option_delta: normalizeNumber(row['OptionDelta']),
        option_theta: normalizeNumber(row['OptionTheta']),
        net_liq: netLiq,
      };

      if (fileUploadId) {
        fila.file_upload_id = fileUploadId;
      }

      filasProcesadas.push(fila);
    }
  }

  return filasProcesadas;
};