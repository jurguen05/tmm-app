// lib/mkTosParser.ts

import { normalizeNumber } from './formatters';

export { normalizeNumber };

export interface ParsedMkTosQuoteRow {
  quote_date: string;
  symbol: string;
  description: string;
  last_price: number;
  high_52: number;
  low_52: number;
  ema: number;
  low_100_day: number;
  high_price: number;
  low_price: number;
  bollinger_bands: number;
  sma_10w: number;
  mac_stop: number;
  trendpilot_stop: number;
  sma_10d: number;
  sma_100d: number;
  file_upload_id?: string;
}

export const procesarFilasMkTos = (
  csvData: any[],
  quoteDate: string,
  fileUploadId?: string
): ParsedMkTosQuoteRow[] => {
  const filasProcesadas: ParsedMkTosQuoteRow[] = [];

  for (const row of csvData) {
    const symbol = row['Symbol'];
    
    // Ignoramos filas vacías o títulos repetidos
    if (!symbol || symbol.includes('Symbol') || symbol.trim() === '') continue;

    const fila: ParsedMkTosQuoteRow = {
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