// lib/strategiesCalculator.ts

import { Position, Transaction, MkTosQuote, ConsolidatedStrategyStop, Trade } from '../types';
import { normalizeUniqueKey } from './formatters';

export type { ConsolidatedStrategyStop };

/**
 * Función pura de dominio que consolida las posiciones activas con su historial de transacciones,
 * la tabla maestra de trades (si está disponible) y las cotizaciones de MK-TOS, calculando el trade actual,
 * estrategia asignada, precio de entrada, rentabilidad y stops según las reglas de cada estrategia.
 */
export const consolidarStrategiesStops = (
  positions: Position[],
  transactions: Transaction[],
  mkTosQuotes?: MkTosQuote[],
  trades?: Trade[]
): ConsolidatedStrategyStop[] => {
  if (!positions || positions.length === 0) return [];

  // Indexar las cotizaciones de MK-TOS por símbolo (quedándonos con la más reciente si hay varias)
  const quotesBySymbol = new Map<string, MkTosQuote>();
  if (mkTosQuotes && mkTosQuotes.length > 0) {
    for (const q of mkTosQuotes) {
      if (!q.symbol) continue;
      const sym = q.symbol.trim().toUpperCase();
      if (!quotesBySymbol.has(sym)) {
        quotesBySymbol.set(sym, q);
      }
    }
  }

  // Indexar trades de la tabla maestra si fueron provistos
  const tradesByCode = new Map<number, Trade>();
  const tradesByKey = new Map<string, Trade>();
  if (trades && trades.length > 0) {
    for (const tr of trades) {
      if (tr.trade_code !== null && tr.trade_code !== undefined && !isNaN(Number(tr.trade_code))) {
        tradesByCode.set(Number(tr.trade_code), tr);
      }
      if (tr.unique_key) {
        tradesByKey.set(normalizeUniqueKey(tr.unique_key), tr);
      }
    }
  }

  const consolidado: ConsolidatedStrategyStop[] = positions.map((pos) => {
    const posNormKey = normalizeUniqueKey(pos.unique_key);
    const txsDelCodigo = transactions?.filter(t => normalizeUniqueKey(t.unique_key) === posNormKey) || [];
    
    // Filtrar transacciones abiertas ordenadas de más reciente a más antigua
    const txsOpen = txsDelCodigo.filter(t => t.position_status?.toLowerCase() === 'open');
    const txsOpenOrdenadas = [...txsOpen].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const trade_code = txsOpenOrdenadas.length > 0 && txsOpenOrdenadas[0].trade_code !== null && txsOpenOrdenadas[0].trade_code !== undefined
      ? String(txsOpenOrdenadas[0].trade_code) 
      : '-';
      
    const strategy = txsOpenOrdenadas.length > 0
      ? (txsOpenOrdenadas[0].strategies?.name || txsOpenOrdenadas[0].strategy || 'S/D')
      : 'S/D';

    const strategy_id = txsOpenOrdenadas.length > 0 ? txsOpenOrdenadas[0].strategy_id : null;

    // Para el trade actual, buscar la primera compra cronológica de TODO el trade
    const txsDelTradeActual = trade_code && trade_code !== '-'
      ? (transactions?.filter(t => t.trade_code !== null && t.trade_code !== undefined && String(t.trade_code) === String(trade_code)) || [])
      : txsDelCodigo;

    const txsOrdenadasFechas = [...txsDelTradeActual].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Buscar la primera compra del trade
    const primeraCompra = txsOrdenadasFechas.find(t => 
      (t.amount !== null && t.amount !== undefined && t.amount < 0) ||
      (t.action && t.action.toLowerCase().includes('buy'))
    ) || txsOrdenadasFechas[0];
    
    const entryPrice = primeraCompra ? (primeraCompra.stock_entry_price || 0) : 0;
    const lastPrice = pos.stock_last || 0;

    // Verificar si existe registro maestro en 'trades'
    const tradeFromMaster = (trade_code && trade_code !== '-' && !isNaN(Number(trade_code)))
      ? tradesByCode.get(Number(trade_code))
      : tradesByKey.get(posNormKey);

    const finalStrategy = tradeFromMaster?.strategies?.name || strategy;
    const finalStrategyId = tradeFromMaster?.strategy_id ?? strategy_id;
    const finalEntryPrice = (tradeFromMaster?.stock_entry_price !== null && tradeFromMaster?.stock_entry_price !== undefined && tradeFromMaster.stock_entry_price > 0)
      ? tradeFromMaster.stock_entry_price
      : entryPrice;
    const firstBuyDate = tradeFromMaster?.first_buy_date || (primeraCompra?.date || null);
    const weekendTraderFlag = tradeFromMaster?.weekend_trader_flag ?? false;

    let rentabilidad = 0;
    if (finalEntryPrice > 0 && lastPrice > 0) {
      rentabilidad = (lastPrice / finalEntryPrice) - 1;
    }

    // Buscar cotización técnica en MK-TOS para este símbolo
    const symKey = (pos.symbol || '').trim().toUpperCase();
    const quote = quotesBySymbol.get(symKey);

    // Identificación de estrategia
    const normStrategy = finalStrategy.toLowerCase().replace(/[\s-_]+/g, '');
    const isTechTrader = normStrategy === 'techtrader' || normStrategy === 'techtrade';

    let stop: string | number = '-';
    let stopValue: number | null = null;
    let needsReview = false;

    if (isTechTrader) {
      // Regla Tech Trader:
      // 1. Si no existe cotización del símbolo en MK-TOS -> marcar Review
      if (!quote) {
        stop = 'Review';
        needsReview = true;
      } else {
        const protectiveStop = finalEntryPrice > 0 ? finalEntryPrice * 0.9 : 0;
        const trailingStop = quote.ema || 0;
        const stopCalculado = Math.max(protectiveStop, trailingStop);

        if (stopCalculado > 0) {
          stop = stopCalculado;
          stopValue = stopCalculado;
          needsReview = false;
        } else {
          stop = 'Review';
          needsReview = true;
        }
      }
    }

    return {
      id: pos.id,
      trade_code: trade_code,
      symbol: pos.symbol,
      strategy: finalStrategy,
      strategy_id: finalStrategyId,
      entryPrice: finalEntryPrice,
      lastPrice: lastPrice,
      first_buy_date: firstBuyDate,
      weekend_trader_flag: weekendTraderFlag,
      stop: stop,
      stopValue: stopValue,
      needsReview: needsReview,
      rentabilidad: rentabilidad
    };
  });

  return consolidado.sort((a, b) => a.symbol.localeCompare(b.symbol));
};
