// lib/equityCurveCalculator.ts
import { Trade, Transaction, EquityCurvePoint, EquityCurveSummary } from '../types';

/**
 * Calcula la curva de equidad acumulada y los picos históricos (High Water Mark)
 * a partir de los trades cerrados ordenados cronológicamente.
 *
 * Sigue fielmente la lógica cuantitativa de Google Sheets:
 * - Secuencia ordinal (#): 0, 1, 2, ...
 * - Period (days): closed_date - first_buy_date
 * - P&L (trade): realized_pnl ?? cash_flow ?? suma de transacciones
 * - Closed Equity: Suma acumulativa de P&L
 * - Peaks: Nuevo máximo histórico acumulado (null si no supera el pico anterior)
 * - Drawdown ($): Closed Equity - Peak (<= 0)
 * - Drawdown (%): (Closed Equity - Peak) / Peak (cuando Peak > 0)
 */
export function calculateEquityCurve(
  trades: Trade[],
  transactions?: Transaction[]
): EquityCurveSummary {
  // 1. Mapa de fallback para P&L por si el trade no tiene realized_pnl asignado
  const txSumByTradeCode = new Map<number, number>();
  if (transactions && transactions.length > 0) {
    for (const tx of transactions) {
      if (tx.trade_code !== null && tx.trade_code !== undefined) {
        const code = Number(tx.trade_code);
        if (!isNaN(code)) {
          const amt = typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0;
          txSumByTradeCode.set(code, (txSumByTradeCode.get(code) || 0) + amt);
        }
      }
    }
  }

  // 2. Filtrar trades cerrados válidos (excluyendo TradeID 1 si representa depósitos / no-trade)
  const closedTrades = (trades || []).filter(t => {
    if (!t) return false;
    const isClosed = (t.status || '').toLowerCase() === 'closed';
    const codeNum = Number(t.trade_code);
    return isClosed && !isNaN(codeNum) && codeNum > 1;
  });

  // 3. Ordenar cronológicamente por closed_date (fallback: first_buy_date, trade_code)
  closedTrades.sort((a, b) => {
    const dateA = a.closed_date || a.first_buy_date || '';
    const dateB = b.closed_date || b.first_buy_date || '';
    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    return Number(a.trade_code || 0) - Number(b.trade_code || 0);
  });

  if (closedTrades.length === 0) {
    return {
      points: [],
      currentClosedEquity: 0,
      maxHistoricalPeak: 0,
      maxDrawdownAmount: 0,
      maxDrawdownPct: 0,
      maxUnderwaterTrades: 0,
      maxUnderwaterDays: 0,
      totalClosedTrades: 0
    };
  }

  const points: EquityCurvePoint[] = [];
  let runningEquity = 0;
  let runningPeak = 0;
  let maxHistoricalPeak = 0;
  let maxDrawdownAmount = 0;
  let maxDrawdownPct = 0;

  // Seguimiento de rachas bajo el agua (underwater streaks)
  let currentUnderwaterTrades = 0;
  let maxUnderwaterTrades = 0;
  let underwaterStartDate: string | null = null;
  let maxUnderwaterDays = 0;

  for (let i = 0; i < closedTrades.length; i++) {
    const t = closedTrades[i];
    const codeNum = Number(t.trade_code);

    // Determinar P&L del trade con fallbacks limpios
    let pnl = 0;
    if (t.realized_pnl !== null && t.realized_pnl !== undefined && !isNaN(Number(t.realized_pnl))) {
      pnl = Number(t.realized_pnl);
    } else if (t.cash_flow !== null && t.cash_flow !== undefined && !isNaN(Number(t.cash_flow))) {
      pnl = Number(t.cash_flow);
    } else if (txSumByTradeCode.has(codeNum)) {
      pnl = txSumByTradeCode.get(codeNum)!;
    }
    pnl = Number(pnl.toFixed(2));

    // Duración del trade en días (closed_date - first_buy_date)
    let periodDays = 0;
    if (t.closed_date && t.first_buy_date) {
      const d1 = Date.parse(t.first_buy_date);
      const d2 = Date.parse(t.closed_date);
      if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
        periodDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      }
    }

    // Closed Equity acumulada
    runningEquity = Number((runningEquity + pnl).toFixed(2));

    // Lógica de Peaks y Drawdown
    let isPeak = false;
    let peakValue: number | null = null;

    if (runningEquity > runningPeak) {
      // Nuevo máximo histórico (HWM) alcanzado
      isPeak = true;
      peakValue = runningEquity;
      runningPeak = runningEquity;
      maxHistoricalPeak = runningEquity;

      // Cerrar racha bajo el agua
      currentUnderwaterTrades = 0;
      underwaterStartDate = null;
    } else {
      // Continúa bajo el agua
      isPeak = false;
      peakValue = null;
      currentUnderwaterTrades++;
      if (currentUnderwaterTrades > maxUnderwaterTrades) {
        maxUnderwaterTrades = currentUnderwaterTrades;
      }

      const prevTrade = i > 0 ? closedTrades[i - 1] : null;
      const refDate: string | null = underwaterStartDate ?? prevTrade?.closed_date ?? t.first_buy_date ?? t.closed_date ?? null;
      if (!underwaterStartDate && refDate) {
        underwaterStartDate = refDate;
      }

      if (underwaterStartDate && t.closed_date) {
        const uStart = Date.parse(underwaterStartDate);
        const uEnd = Date.parse(t.closed_date);
        if (!isNaN(uStart) && !isNaN(uEnd) && uEnd >= uStart) {
          const days = Math.round((uEnd - uStart) / (1000 * 60 * 60 * 24));
          if (days > maxUnderwaterDays) {
            maxUnderwaterDays = days;
          }
        }
      }
    }

    // Drawdown actual relativo al High Water Mark
    const drawdownAmount = runningPeak > 0 ? Number((runningEquity - runningPeak).toFixed(2)) : (runningEquity < 0 ? runningEquity : 0);
    const drawdownPct = runningPeak > 0 ? Number(((runningEquity - runningPeak) / runningPeak).toFixed(4)) : 0;

    if (drawdownAmount < maxDrawdownAmount) {
      maxDrawdownAmount = drawdownAmount;
    }
    if (drawdownPct < maxDrawdownPct) {
      maxDrawdownPct = drawdownPct;
    }

    points.push({
      index: i,
      trade_code: codeNum,
      symbol: t.symbol || 'N/A',
      first_buy_date: t.first_buy_date || null,
      closed_date: t.closed_date || null,
      period_days: periodDays,
      pnl,
      closed_equity: runningEquity,
      peak: peakValue,
      running_peak: runningPeak,
      drawdown_amount: drawdownAmount,
      drawdown_pct: drawdownPct,
      is_peak: isPeak
    });
  }

  return {
    points,
    currentClosedEquity: runningEquity,
    maxHistoricalPeak,
    maxDrawdownAmount,
    maxDrawdownPct,
    maxUnderwaterTrades,
    maxUnderwaterDays,
    totalClosedTrades: points.length
  };
}
