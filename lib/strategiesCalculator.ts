// lib/strategiesCalculator.ts

import { Position, Transaction, MkTosQuote, ConsolidatedStrategyStop, Trade, Strategy } from '../types';
import { normalizeUniqueKey, esViernes, esCierreSemanal, parsearFechaTOS } from './formatters';

export type { ConsolidatedStrategyStop };

export interface MaxStockPriceResult {
  max_stock_price: number | null;
  max_stock_price_date: string | null;
}

/**
 * Calcula el precio máximo alcanzado por la acción y su fecha según las reglas de cada estrategia:
 * - '20% Flipper': El last/high más alto desde first_buy_date hasta hoy (evaluando todos los días hábiles).
 * - 'Weekend Trader': El precio máximo (High) desde first_buy_date hasta hoy, evaluando sesiones de cierre semanal (viernes, o jueves si fue feriado).
 * - Demás estrategias: No aplica (retorna null).
 */
export const calcularMaxStockPriceYFecha = (
  strategy: string,
  firstBuyDate: string | null,
  stockEntryPrice: number | null,
  quotesDelSimbolo: MkTosQuote[],
  currentStockLast?: number | null,
  currentDate?: string | null,
  weekendTraderFlag?: boolean
): MaxStockPriceResult => {
  const norm = (strategy || '').toLowerCase().replace(/[\s-_%]+/g, '');
  const is20Flipper = norm.includes('20flipper') || norm.includes('flipper');
  const isWeekendTrader = norm.includes('weekend') || weekendTraderFlag === true;

  if (!is20Flipper && !isWeekendTrader) {
    return { max_stock_price: null, max_stock_price_date: null };
  }

  const normFirstBuy = firstBuyDate ? (parsearFechaTOS(firstBuyDate) || firstBuyDate.substring(0, 10)) : null;

  // Conjunto de fechas disponibles para el símbolo (para detectar cierres en jueves por feriado)
  const allDatesOfQuotes = new Set(
    quotesDelSimbolo
      .map(q => parsearFechaTOS(q.quote_date) || q.quote_date?.substring(0, 10))
      .filter(Boolean) as string[]
  );

  let highestPrice = stockEntryPrice && stockEntryPrice > 0 ? stockEntryPrice : 0;
  let highestDate = normFirstBuy || null;

  // Si es Weekend Trader y firstBuyDate no cayó en sesión de cierre semanal (viernes o jueves por feriado), no arranca con esa fecha como pico
  if (isWeekendTrader && normFirstBuy && !esCierreSemanal(normFirstBuy, allDatesOfQuotes)) {
    highestPrice = 0;
    highestDate = null;
  }

  const minDate = normFirstBuy || '1970-01-01';
  const relevantQuotes = quotesDelSimbolo.filter(q => {
    if (!q.quote_date) return false;
    const qDate = parsearFechaTOS(q.quote_date) || q.quote_date.substring(0, 10);
    return qDate >= minDate;
  });

  for (const q of relevantQuotes) {
    const qDate = parsearFechaTOS(q.quote_date) || q.quote_date.substring(0, 10);
    // En Weekend Trader, evaluamos sesiones de cierre semanal (viernes, o jueves si el viernes fue feriado)
    if (isWeekendTrader && !esCierreSemanal(qDate, allDatesOfQuotes)) {
      continue;
    }

    // Para 20% Flipper y Weekend Trader se evalúa el máximo alcanzado (columna High / high_price)
    const p = (q.high_price && q.high_price > 0) ? q.high_price : (q.last_price || 0);

    if (p > highestPrice) {
      highestPrice = p;
      highestDate = qDate;
    }
  }

  // Evaluar también el precio actual de la posición (si corresponde a hoy o sesión activa)
  if (currentStockLast && currentStockLast > 0 && currentDate) {
    const normCurrentDate = parsearFechaTOS(currentDate) || currentDate.substring(0, 10);
    const isEligibleToday = is20Flipper || (isWeekendTrader && esCierreSemanal(normCurrentDate, allDatesOfQuotes));
    if (isEligibleToday && currentStockLast > highestPrice) {
      highestPrice = currentStockLast;
      highestDate = normCurrentDate;
    }
  }

  return {
    max_stock_price: highestPrice > 0 ? highestPrice : null,
    max_stock_price_date: highestDate
  };
};

/**
 * Función pura de dominio que consolida las posiciones activas con su historial de transacciones,
 * la tabla maestra de trades (si está disponible) y las cotizaciones de MK-TOS, calculando el trade actual,
 * estrategia asignada, precio de entrada, rentabilidad y stops según las reglas de cada estrategia.
 */
export const consolidarStrategiesStops = (
  positions: Position[],
  transactions: Transaction[],
  mkTosQuotes?: MkTosQuote[],
  trades?: Trade[],
  strategiesList?: Strategy[]
): ConsolidatedStrategyStop[] => {
  if (!positions || positions.length === 0) return [];

  // Indexar estrategias por ID si fueron provistas
  const strategiesById = new Map<number, Strategy>();
  if (strategiesList && strategiesList.length > 0) {
    for (const st of strategiesList) {
      strategiesById.set(st.id, st);
    }
  }

  // Indexar las cotizaciones de MK-TOS por símbolo (quedándonos con la más reciente si hay varias)
  const quotesBySymbol = new Map<string, MkTosQuote>();
  const allQuotesBySymbol = new Map<string, MkTosQuote[]>();
  if (mkTosQuotes && mkTosQuotes.length > 0) {
    for (const q of mkTosQuotes) {
      if (!q.symbol) continue;
      const sym = q.symbol.trim().toUpperCase();
      if (!quotesBySymbol.has(sym)) {
        quotesBySymbol.set(sym, q);
      }
      if (!allQuotesBySymbol.has(sym)) {
        allQuotesBySymbol.set(sym, []);
      }
      allQuotesBySymbol.get(sym)!.push(q);
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

  // Obtener y analizar cotizaciones de SPY ordenadas por fecha descendente para Weekend Trader
  const spyQuotes = (allQuotesBySymbol.get('SPY') || [])
    .slice()
    .sort((a, b) => (b.quote_date || '').localeCompare(a.quote_date || ''));

  const spyDatesSet = new Set(
    spyQuotes
      .map(q => parsearFechaTOS(q.quote_date) || q.quote_date?.substring(0, 10))
      .filter(Boolean) as string[]
  );

  // Buscar la cotización de cierre semanal más reciente de SPY (viernes, o jueves si fue feriado)
  const latestWeeklySpyQuote = spyQuotes.find(q => {
    const d = parsearFechaTOS(q.quote_date) || q.quote_date?.substring(0, 10);
    return d && esCierreSemanal(d, spyDatesSet);
  }) || spyQuotes[0]; // fallback a la más reciente disponible de SPY

  const isSpyAvailable = Boolean(
    latestWeeklySpyQuote && 
    latestWeeklySpyQuote.last_price > 0 && 
    latestWeeklySpyQuote.sma_10w > 0
  );

  const isLatestSpyRed = Boolean(
    isSpyAvailable && 
    latestWeeklySpyQuote!.last_price <= latestWeeklySpyQuote!.sma_10w
  );

  // Pre-indexar transacciones una sola vez (evita O(posiciones × transacciones))
  const txsByNormKey = new Map<string, Transaction[]>();
  const txsByTradeCode = new Map<string, Transaction[]>();
  for (const t of transactions || []) {
    const nk = normalizeUniqueKey(t.unique_key);
    const byKey = txsByNormKey.get(nk);
    if (byKey) byKey.push(t); else txsByNormKey.set(nk, [t]);

    if (t.trade_code !== null && t.trade_code !== undefined) {
      const tc = String(t.trade_code);
      const byCode = txsByTradeCode.get(tc);
      if (byCode) byCode.push(t); else txsByTradeCode.set(tc, [t]);
    }
  }

  const consolidado: ConsolidatedStrategyStop[] = positions.map((pos) => {
    const posNormKey = normalizeUniqueKey(pos.unique_key);
    const txsDelCodigo = txsByNormKey.get(posNormKey) || [];
    
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
      ? (txsByTradeCode.get(String(trade_code)) || [])
      : txsDelCodigo;

    const txsOrdenadasFechas = [...txsDelTradeActual].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Buscar la primera compra del trade
    const primeraCompra = txsOrdenadasFechas.find(t => 
      (t.amount !== null && t.amount !== undefined && t.amount < 0) ||
      (t.action && t.action.toLowerCase().includes('buy'))
    ) || txsOrdenadasFechas[0];
    
    const entryPrice = primeraCompra ? (primeraCompra.stock_entry_price || 0) : 0;

    // Buscar cotización técnica en MK-TOS para este símbolo
    const symKey = (pos.symbol || '').trim().toUpperCase();
    const quote = quotesBySymbol.get(symKey);
    const lastPrice = (pos.stock_last && pos.stock_last > 0) ? pos.stock_last : (quote?.last_price || 0);

    // Verificar si existe registro maestro en 'trades'
    const tradeFromMaster = (trade_code && trade_code !== '-' && !isNaN(Number(trade_code)))
      ? tradesByCode.get(Number(trade_code))
      : tradesByKey.get(posNormKey);

    const finalStrategyId = tradeFromMaster?.strategy_id ?? strategy_id;
    const strategyRecord = finalStrategyId ? strategiesById.get(finalStrategyId) : null;
    const finalStrategy = strategyRecord?.name || tradeFromMaster?.strategies?.name || strategy;
    const finalEntryPrice = (tradeFromMaster?.stock_entry_price !== null && tradeFromMaster?.stock_entry_price !== undefined && tradeFromMaster.stock_entry_price > 0)
      ? tradeFromMaster.stock_entry_price
      : entryPrice;
    const firstBuyDate = tradeFromMaster?.first_buy_date || (primeraCompra?.date || null);
    const isTradeClosed = tradeFromMaster?.status === 'Closed';
    let weekendTraderFlag = isTradeClosed ? false : (tradeFromMaster?.weekend_trader_flag ?? false);

    let rentabilidad = 0;
    if (finalEntryPrice > 0 && lastPrice > 0) {
      rentabilidad = (lastPrice / finalEntryPrice) - 1;
    }

    // Identificación de estrategia
    const normStrategy = finalStrategy.toLowerCase().replace(/[\s-_%]+/g, '');
    const isTechTrader = normStrategy === 'techtrader' || normStrategy === 'techtrade';
    const isTrendPilot = normStrategy.includes('trendpilot') || 
                         normStrategy.includes('tendpilot') || 
                         normStrategy === 'trend' || 
                         normStrategy.includes('pilot');
    const isMAC = normStrategy === 'mac' || 
                  normStrategy === 'macd' || 
                  normStrategy.includes('macd') || 
                  normStrategy === 'macstrategy' || 
                  normStrategy === 'macstop';
    const is20Flipper = normStrategy.includes('20flipper') || normStrategy.includes('flipper');
    const isWeekendTrader = normStrategy.includes('weekendtrader') || 
                            normStrategy.includes('weekend') || 
                            weekendTraderFlag === true;
    const isNewYearlyHighs = normStrategy.includes('newyearlyhigh') || 
                             normStrategy.includes('yearlyhigh') || 
                             normStrategy.includes('newyearly');
    const is100DayHigh = normStrategy.includes('100day') || 
                         normStrategy.includes('100-day') || 
                         (normStrategy.includes('100') && normStrategy.includes('high'));
    const isBBO = normStrategy === 'bbo' || 
                  normStrategy.includes('bbo') || 
                  normStrategy.includes('bollinger');
    const isHedge = normStrategy === 'hedge' || 
                    normStrategy.includes('hedge') || 
                    normStrategy.includes('hegde') || 
                    normStrategy.includes('hedging');

    // Calcular max_stock_price y max_stock_price_date para 20% Flipper y Weekend Trader
    const quotesHistDelSimbolo = allQuotesBySymbol.get(symKey) || [];
    const maxCalc = calcularMaxStockPriceYFecha(
      finalStrategy,
      firstBuyDate,
      finalEntryPrice,
      quotesHistDelSimbolo,
      lastPrice,
      pos.statement_date,
      weekendTraderFlag
    );

    const max_stock_price = isTradeClosed ? null : (
      (tradeFromMaster?.max_stock_price && tradeFromMaster.max_stock_price > (maxCalc.max_stock_price || 0))
        ? tradeFromMaster.max_stock_price
        : maxCalc.max_stock_price
    );

    const max_stock_price_date = isTradeClosed ? null : (
      (tradeFromMaster?.max_stock_price && tradeFromMaster.max_stock_price > (maxCalc.max_stock_price || 0))
        ? (tradeFromMaster.max_stock_price_date || maxCalc.max_stock_price_date)
        : maxCalc.max_stock_price_date
    );

    let stop: string | number = 'Review';
    let stopValue: number | null = null;
    let signal: number | null = null;
    let isStopRed = false;
    let needsReview = true;
    let reviewReason: string | undefined = undefined;

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
          // Regla Tech Trader: solo se pone el rojo si el valor de LAST es menor al valor del stop
          if (lastPrice > 0 && lastPrice < stopCalculado) {
            isStopRed = true;
          }
        } else {
          stop = 'Review';
          needsReview = true;
        }
      }
    } else if (isTrendPilot) {
      // Regla Trend Pilot / Tend Pilot:
      // En Stop SIEMPRE se muestra Last.
      // En Signal se muestra el valor si es >= 3, de lo contrario null ('-').
      // Si es >= 3, se pinta la celda de Stop de rojo.
      if (!quote) {
        stop = 'Review';
        needsReview = true;
      } else {
        const tpVal = quote.trendpilot_stop;
        const num = (tpVal !== null && tpVal !== undefined && !isNaN(tpVal)) ? tpVal : 0;
        signal = num >= 3 ? num : null;
        stop = lastPrice;
        stopValue = lastPrice;
        needsReview = false;
        isStopRed = num >= 3;
      }
    } else if (isMAC) {
      // Regla MAC / MACD:
      // En Stop SIEMPRE se muestra Last.
      // En Signal se muestra el valor si es >= 3, de lo contrario null ('-').
      // Si es >= 3, se pinta la celda de Stop de rojo.
      if (!quote) {
        stop = 'Review';
        needsReview = true;
      } else {
        const macVal = quote.mac_stop;
        const num = (macVal !== null && macVal !== undefined && !isNaN(macVal)) ? macVal : 0;
        signal = num >= 3 ? num : null;
        stop = lastPrice;
        stopValue = lastPrice;
        needsReview = false;
        isStopRed = num >= 3;
      }
    } else if (is20Flipper) {
      // Regla 20% Flipper:
      // El Stop es un 0.8 del Max Price alcanzado (max_stock_price).
      // Si el LAST está por debajo de ese valor, se pone en rojo.
      if (max_stock_price && max_stock_price > 0) {
        const stopCalculado = Number((max_stock_price * 0.8).toFixed(4));
        stop = stopCalculado;
        stopValue = stopCalculado;
        needsReview = false;
        if (lastPrice > 0 && lastPrice < stopCalculado) {
          isStopRed = true;
        }
      } else {
        stop = 'Review';
        needsReview = true;
      }
    } else if (isNewYearlyHighs) {
      // Regla New Yearly Highs:
      // El Stop es el mínimo de 52 semanas / 250 días (columna '52Low' / low_52 en MK-TOS).
      // Si el LAST está por debajo de ese valor, se pone en rojo.
      if (!quote || quote.low_52 === null || quote.low_52 === undefined || quote.low_52 <= 0) {
        stop = 'Review';
        needsReview = true;
      } else {
        const stopCalculado = quote.low_52;
        stop = stopCalculado;
        stopValue = stopCalculado;
        needsReview = false;
        if (lastPrice > 0 && lastPrice < stopCalculado) {
          isStopRed = true;
        }
      }
    } else if (is100DayHigh) {
      // Regla 100-day-High:
      // El Stop es el mínimo de los últimos 100 días (columna '100-day-Low' / low_100_day en MK-TOS).
      // Si el LAST cierra por debajo de ese valor, se pone en rojo (alerta de venta).
      if (!quote || quote.low_100_day === null || quote.low_100_day === undefined || quote.low_100_day <= 0) {
        stop = 'Review';
        needsReview = true;
      } else {
        const stopCalculado = quote.low_100_day;
        stop = stopCalculado;
        stopValue = stopCalculado;
        needsReview = false;
        if (lastPrice > 0 && lastPrice < stopCalculado) {
          isStopRed = true;
        }
      }
    } else if (isBBO) {
      // Regla BBO (Bollinger Bands):
      // El Stop es la banda inferior configurada a 1 desviación estándar (columna 'BBO' / bollinger_bands en MK-TOS).
      // Punto de salida: Si el precio (Last) registra un cierre por debajo de la banda inferior (Last < Stop), se pone en rojo.
      if (!quote || quote.bollinger_bands === null || quote.bollinger_bands === undefined || quote.bollinger_bands <= 0) {
        stop = 'Review';
        needsReview = true;
      } else {
        const stopCalculado = quote.bollinger_bands;
        stop = stopCalculado;
        stopValue = stopCalculado;
        needsReview = false;
        if (lastPrice > 0 && lastPrice < stopCalculado) {
          isStopRed = true;
        }
      }
    } else if (isHedge) {
      // Regla Hedge:
      // En Stop solo se muestra el valor de Last y no hay regla de stop (no se dispara alerta roja).
      if (lastPrice && lastPrice > 0) {
        stop = lastPrice;
        stopValue = lastPrice;
        needsReview = false;
        isStopRed = false;
      } else {
        stop = 'Review';
        needsReview = true;
      }
    } else if (isWeekendTrader) {
      // Regla Weekend Trader:
      // 1. Monitorea el High más alto alcanzado en sesiones de cierre semanal (viernes, o jueves si fue feriado).
      // 2. Filtro de mercado general SPY vs SMA 10W al cierre semanal:
      //    - Si SPY > SMA 10W (cinta verde): Stop = High * 0.60 (-40%)
      //    - Si SPY <= SMA 10W (cinta roja): Stop = High * 0.90 (-10%)
      // 3. Salvedad irreversible: Una vez que un trade pasa a cinta roja (SPY <= SMA 10W),
      //    queda marcado permanentemente con weekend_trader_flag = true y stop al 0.90.
      if (!isSpyAvailable) {
        stop = 'Review';
        needsReview = true;
        reviewReason = 'Missing SPY quote or SMA 10W in MK-TOS (required for Weekend Trader market filter)';
      } else if (!max_stock_price || max_stock_price <= 0) {
        stop = 'Review';
        needsReview = true;
        reviewReason = 'No Friday peak price (High) found in MK-TOS quotes since buy date';
      } else {
        const normBuyDate = firstBuyDate ? (parsearFechaTOS(firstBuyDate) || firstBuyDate.substring(0, 10)) : null;

        // Regla: Todas las operaciones de Weekend Trader compradas antes del 24/07/2026 tienen el flag activo (ON)
        const isBoughtBeforeCutoff = Boolean(normBuyDate && normBuyDate < '2026-07-24');

        const hadHistoricalSpyRed = normBuyDate
          ? spyQuotes.some(sq => {
              const sqDate = parsearFechaTOS(sq.quote_date) || sq.quote_date?.substring(0, 10);
              if (!sqDate || sqDate < normBuyDate) return false;
              if (!esCierreSemanal(sqDate, spyDatesSet)) return false;
              return sq.last_price > 0 && sq.sma_10w > 0 && sq.last_price <= sq.sma_10w;
            })
          : false;

        const effectiveFlag = Boolean(
          tradeFromMaster?.weekend_trader_flag || 
          isBoughtBeforeCutoff ||
          hadHistoricalSpyRed || 
          isLatestSpyRed
        );

        weekendTraderFlag = effectiveFlag;

        const multiplier = effectiveFlag ? 0.90 : 0.60;
        const stopCalculado = Number((max_stock_price * multiplier).toFixed(4));
        stop = stopCalculado;
        stopValue = stopCalculado;
        needsReview = false;

        if (lastPrice > 0 && lastPrice < stopCalculado) {
          isStopRed = true;
        }
      }
    } else {
      // Cualquier otra estrategia no configurada o sin stop explícito pasa a Review
      stop = 'Review';
      needsReview = true;
    }

    // Regla global: si el stop es '-' o no es un valor numérico válido, se marca como Review
    if (stop === '-' || stop === 'Review' || typeof stop !== 'number' || isNaN(stop)) {
      stop = 'Review';
      needsReview = true;
      isStopRed = false;
    }

    return {
      id: pos.id,
      trade_code: trade_code,
      symbol: pos.symbol,
      strategy: finalStrategy,
      strategy_id: finalStrategyId,
      entryPrice: finalEntryPrice,
      signal: signal,
      lastPrice: lastPrice,
      first_buy_date: firstBuyDate,
      weekend_trader_flag: weekendTraderFlag,
      max_stock_price: max_stock_price,
      max_stock_price_date: max_stock_price_date,
      stop: stop,
      stopValue: stopValue,
      isStopRed: isStopRed,
      needsReview: needsReview,
      reviewReason: reviewReason,
      rentabilidad: rentabilidad
    };
  });

  return consolidado.sort((a, b) => a.symbol.localeCompare(b.symbol));
};
