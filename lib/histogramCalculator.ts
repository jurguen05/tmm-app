// lib/histogramCalculator.ts
import { Trade, HistogramBin, HistogramResult } from '../types';

/**
 * Calcula la distribución de frecuencias y la curva de frecuencia relativa acumulada (CRF)
 * de los resultados P&L de todos los trades cerrados.
 *
 * Sigue fielmente la lógica cuantitativa de Google Sheets:
 * - Estadísticas base: Min, Max, N, Mean
 * - Bins homogéneos K (por defecto 30 bins)
 * - f: Frecuencia absoluta (conteo de operaciones por bin)
 * - rfd: Frecuencia relativa (f / N)
 * - crf: Frecuencia acumulada (suma progresiva de rfd de 0.00 a 1.00)
 */
export function calculatePnLHistogram(
  tradesOrPnl: (Trade | number)[],
  requestedBins: number = 30
): HistogramResult {
  // 1. Extraer y sanear los valores de P&L numéricos
  const values: number[] = [];
  for (const item of tradesOrPnl) {
    if (typeof item === 'number') {
      if (!isNaN(item)) values.push(Number(item.toFixed(2)));
    } else if (item && typeof item === 'object') {
      const isClosed = (item.status || '').toLowerCase() === 'closed';
      const codeNum = Number(item.trade_code);
      // Excluir TradeID 1 si representa depósitos o transfers
      if (isClosed && !isNaN(codeNum) && codeNum > 1) {
        let pnl = 0;
        if (item.realized_pnl !== null && item.realized_pnl !== undefined && !isNaN(Number(item.realized_pnl))) {
          pnl = Number(item.realized_pnl);
        } else if (item.cash_flow !== null && item.cash_flow !== undefined && !isNaN(Number(item.cash_flow))) {
          pnl = Number(item.cash_flow);
        }
        values.push(Number(pnl.toFixed(2)));
      }
    }
  }

  const n = values.length;
  if (n === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      n: 0,
      bins: []
    };
  }

  // 2. Estadísticas base
  let min = values[0];
  let max = values[0];
  let sum = 0;

  for (const val of values) {
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
  }

  const mean = Number((sum / n).toFixed(2));

  // Caso especial: todos los trades tienen exactamente el mismo P&L
  if (min === max) {
    return {
      min,
      max,
      mean,
      n,
      bins: [
        {
          binIndex: 0,
          binLower: min,
          binUpper: max,
          binMid: min,
          binLabel: `$${min.toFixed(0)}`,
          f: n,
          rfd: 1.0,
          crf: 1.0
        }
      ]
    };
  }

  // 3. Generación de Bins homogéneos K (entre 20 y 35, acotado por N)
  const k = Math.max(10, Math.min(requestedBins, Math.min(n, 35)));
  const binWidth = (max - min) / k;

  const bins: HistogramBin[] = [];
  const frequencies = new Array(k).fill(0);

  // 4. Asignación de frecuencias absolutas f
  for (const val of values) {
    let index = Math.floor((val - min) / binWidth);
    if (index >= k) {
      index = k - 1; // Incluir el valor máximo exacto en el último bin
    }
    if (index < 0) {
      index = 0;
    }
    frequencies[index]++;
  }

  // 5. Cálculo de frecuencias relativas (rfd) y acumuladas (crf)
  let cumulativeRfd = 0;

  for (let i = 0; i < k; i++) {
    const f = frequencies[i];
    const rfd = Number((f / n).toFixed(4));
    cumulativeRfd += rfd;
    const crf = i === k - 1 ? 1.0 : Number(Math.min(1.0, cumulativeRfd).toFixed(4));

    const lower = Number((min + i * binWidth).toFixed(2));
    const upper = Number((min + (i + 1) * binWidth).toFixed(2));
    const mid = Number(((lower + upper) / 2).toFixed(2));

    const formatBound = (val: number) => {
      const isNeg = val < 0;
      const abs = Math.abs(val);
      const str = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${Math.round(abs)}`;
      return isNeg ? `-$${str}` : `$${str}`;
    };

    const binLabel = `${formatBound(lower)} to ${formatBound(upper)}`;

    bins.push({
      binIndex: i,
      binLower: lower,
      binUpper: upper,
      binMid: mid,
      binLabel,
      f,
      rfd,
      crf
    });
  }

  return {
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    mean,
    n,
    bins
  };
}
