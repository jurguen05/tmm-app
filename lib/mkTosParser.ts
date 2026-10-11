// lib/mkTosParser.ts

// Reutilizamos la misma lógica para limpiar números (sacar comas, N/A, etc.)
export const normalizeNumber = (value: string | undefined | null) => {
  if (!value || value.toLowerCase().includes('loading') || value.toLowerCase() === 'n/a') return 0;
  const cleanStr = value.toString().replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

export const procesarFilasMkTos = (csvData: any[], quoteDate: string, fileUploadId?: string) => {
  const filasProcesadas = [];

  for (const row of csvData) {
    const symbol = row['Symbol'];
    
    // Ignoramos filas vacías o basura
    if (!symbol || symbol.includes('Symbol') || symbol.trim() === '') continue;

    const fila: any = {
      quote_date: quoteDate,
      symbol: symbol.trim(),
      description: row['Description']?.trim() || '',
      last_price: normalizeNumber(row['Last']),
      high_52: normalizeNumber(row['52High']),
      low_52: normalizeNumber(row['52Low']),
      ema: normalizeNumber(row['MovAvgExponential']),
      low_100_day: normalizeNumber(row['100-day-Low']),
      high_price: normalizeNumber(row['High']),
      low_price: normalizeNumber(row['Low']),
      bollinger_bands: normalizeNumber(row['BollingerBands']),
      sma_10w: normalizeNumber(row['SMA 10W']),
      mac_stop: normalizeNumber(row['MAC_STOP']),
      trendpilot_stop: normalizeNumber(row['TrendPilot_STOP']),
      sma_10d: normalizeNumber(row['SMA 10d']),
      sma_100d: normalizeNumber(row['SMA 100d']),
    };

    if (fileUploadId) {
      fila.file_upload_id = fileUploadId;
    }

    filasProcesadas.push(fila);
  }

  return filasProcesadas;
};