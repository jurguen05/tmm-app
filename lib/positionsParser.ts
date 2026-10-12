// lib/positionsParser.ts

export const normalizeNumber = (value: string | undefined | null) => {
  if (!value || value.toLowerCase().includes('loading') || value.toLowerCase() === 'n/a') return 0;
  const cleanStr = value.toString().replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

export const procesarFilasPosiciones = (csvData: any[], statementDate: string, fileUploadId?: string) => {
  const filasProcesadas = [];
  
  const monthMap: { [key: string]: string } = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
    'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };

  let currentTicker = ''; 
  let currentStockMark = 0;
  let currentStockLast = 0;

  for (const row of csvData) {
    const symbolOriginal = row['Instrument'];
    
    if (!symbolOriginal || symbolOriginal.includes('Group') || symbolOriginal.includes('Equities') || symbolOriginal.includes('OVERALL P/L')) continue;

    let uniqueKey, symbol;
    let isHeaderRow = false; 
    let isOption = false;

    if (!symbolOriginal.includes(' ')) {
      currentTicker = symbolOriginal;
      uniqueKey = currentTicker;
      symbol = currentTicker;
      
      const rowLast = normalizeNumber(row['Last']);
      const rowMark = normalizeNumber(row['Mark']);
      currentStockLast = rowLast > 0 ? rowLast : 0;
      currentStockMark = rowMark > 0 ? rowMark : (rowLast > 0 ? rowLast : 0);

      if (!row['Qty'] || row['Qty'].trim() === '') {
        isHeaderRow = true; 
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
        // Fila descriptiva (nombre de empresa, ej: "AVANTOR INC")
        const rowLast = normalizeNumber(row['Last']);
        const rowMark = normalizeNumber(row['Mark']);
        if (rowLast > 0) currentStockLast = rowLast;
        if (rowMark > 0) currentStockMark = rowMark;
        continue; 
      }
    }

    if (!isHeaderRow) {
      const qty = normalizeNumber(row['Qty']);
      const netLiq = normalizeNumber(row['Net Liq']);

      // ==========================================
      // EL FILTRO MÁGICO
      // Si la cantidad es 0 o el Net Liq es 0, ignoramos esta fila
      // ==========================================
      if (qty === 0 || netLiq === 0) {
        continue;
      }

      // Si es una opción, usamos el Mark y Last de la acción subyacente
      const stockMark = isOption && currentStockMark > 0 ? currentStockMark : normalizeNumber(row['Mark']);
      const stockLast = isOption && currentStockLast > 0 ? currentStockLast : normalizeNumber(row['Last']);

      const fila: any = {
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