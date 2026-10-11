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

  for (const row of csvData) {
    const symbolOriginal = row['Instrument'];
    
    if (!symbolOriginal || symbolOriginal.includes('Group') || symbolOriginal.includes('Equities') || symbolOriginal.includes('OVERALL P/L')) continue;

    let uniqueKey, symbol;
    let isHeaderRow = false; 

    if (!symbolOriginal.includes(' ')) {
      currentTicker = symbolOriginal;
      uniqueKey = currentTicker;
      symbol = currentTicker;
      
      if (!row['Qty'] || row['Qty'].trim() === '') {
        isHeaderRow = true; 
      }
    } else {
      const optionMatch = symbolOriginal.match(/^(\d+)\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{2})\s+(\d+(\.\d+)?)\s+(CALL|PUT)$/);
      
      if (optionMatch) {
        const day = optionMatch[2].padStart(2, '0');
        const mm = monthMap[optionMatch[3]];
        const yyyy = "20" + optionMatch[4];
        const strike = parseFloat(optionMatch[5]);
        const type = optionMatch[7] === 'CALL' ? 'C' : 'P';
        
        uniqueKey = `${currentTicker}-${mm}/${day}/${yyyy} ${strike} ${type}`;
        symbol = currentTicker;
      } else {
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

      const fila: any = {
        statement_date: statementDate,
        unique_key: uniqueKey,
        symbol: symbol,
        quantity: qty,
        days: normalizeNumber(row['Days']),
        trade_price: normalizeNumber(row['Trade Price']),
        stock_mark: normalizeNumber(row['Mark']),
        stock_last: normalizeNumber(row['Last']),
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