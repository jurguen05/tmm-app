// lib/dashboardStatsCalculator.ts

import {
  Position,
  Transaction,
  Strategy,
  Trade,
  AssetAllocationSummary,
  AssetAllocationRow,
  StrategyPnLSummary,
  StrategyPnLRow,
  AuditMetricsSummary,
  AuditMetricColumn,
  RiskMultiplesSummary,
  RiskStrategyRow,
  ExecutiveDashboardData
} from '../types';
import { normalizeUniqueKey } from './formatters';

/**
 * Estrategias excluidas explícitamente en las directrices de negocio para los análisis de P&L y Riesgo
 */
export const EXCLUDED_STRATEGIES: readonly string[] = [
  'Short Mean Reversion',
  'Short RSI Thrust',
  'MA Cross -Long',
  'MA Cross -Short',
  'Hedge'
];

/**
 * Normaliza nombres de estrategias para comparaciones insensibles a mayúsculas/minúsculas y espacios
 */
export const isExcludedStrategy = (strategyName: string | null | undefined): boolean => {
  if (!strategyName) return false;
  const clean = strategyName.trim().toLowerCase();
  return EXCLUDED_STRATEGIES.some(ex => ex.toLowerCase() === clean);
};

/**
 * Clasifica una posición como CALL, PUT o Stock a partir de su unique_key
 * Regla de negocio: si termina en ' C' es CALL, si termina en ' P' es PUT (incluyendo Hedge), de lo contrario es Stock.
 */
export const clasificarTipoInstrumento = (uniqueKey: string | null | undefined): 'CALL' | 'PUT' | 'Stock' => {
  if (!uniqueKey) return 'Stock';
  const trimmed = uniqueKey.trim();
  if (trimmed.endsWith(' C') || /\s+C$/i.test(trimmed)) {
    return 'CALL';
  }
  if (trimmed.endsWith(' P') || /\s+P$/i.test(trimmed)) {
    return 'PUT';
  }
  return 'Stock';
};

/**
 * Helper para resolver el nombre de estrategia de una posición utilizando trades o transacciones
 */
export const resolverEstrategiaDePosicion = (
  pos: Position,
  tradesByKey: Map<string, Trade>,
  tradesByCode: Map<number, Trade>,
  txsByKey: Map<string, Transaction[]>,
  strategiesById: Map<number, Strategy>
): string => {
  const normKey = normalizeUniqueKey(pos.unique_key);

  // 1. Verificar si existe trade maestro por unique_key
  const tradeFromKey = tradesByKey.get(normKey);
  if (tradeFromKey) {
    if (tradeFromKey.strategy_id && strategiesById.has(tradeFromKey.strategy_id)) {
      return strategiesById.get(tradeFromKey.strategy_id)!.name;
    }
    if (tradeFromKey.strategies?.name) {
      return tradeFromKey.strategies.name;
    }
  }

  // 2. Buscar en transacciones abiertas de esa unique_key
  const txs = txsByKey.get(normKey) || [];
  const openTxs = txs.filter(t => (t.position_status || '').toLowerCase() === 'open');
  const targetTx = openTxs.length > 0 ? openTxs[openTxs.length - 1] : txs[txs.length - 1];

  if (targetTx) {
    if (targetTx.trade_code && tradesByCode.has(Number(targetTx.trade_code))) {
      const tr = tradesByCode.get(Number(targetTx.trade_code))!;
      if (tr.strategy_id && strategiesById.has(tr.strategy_id)) {
        return strategiesById.get(tr.strategy_id)!.name;
      }
      if (tr.strategies?.name) return tr.strategies.name;
    }
    if (targetTx.strategy_id && strategiesById.has(targetTx.strategy_id)) {
      return strategiesById.get(targetTx.strategy_id)!.name;
    }
    if (targetTx.strategies?.name) {
      return targetTx.strategies.name;
    }
    if (targetTx.strategy && targetTx.strategy.trim() !== '') {
      return targetTx.strategy.trim();
    }
  }

  return 'Unassigned';
};

/**
 * 1. TABLA DE ASIGNACIÓN DE ACTIVOS Y BALANCE DE CARTERA (Asset Allocation)
 * Fórmulas:
 * - Stock Value: Suma de Net Liq de posiciones clasificadas como Stock
 * - CALL Value: Suma de Net Liq de posiciones terminadas en ' C'
 * - PUT Value: Suma de Net Liq de posiciones terminadas en ' P' (incluye Hedge)
 * - Portfolio Value: Stock Value + CALL Value + PUT Value + Cash Balance
 * - % Allocation: (Strategy Portfolio Value / Total Portfolio Value) * 100
 * - Fila Porcentual: % Stock, % CALL, % PUT, % Cash respecto al Portfolio Value total
 */
export const calcularAssetAllocation = (
  positions: Position[],
  strategiesList: Strategy[],
  trades?: Trade[],
  transactions?: Transaction[],
  cashBalance: number = 0
): AssetAllocationSummary => {
  const strategiesById = new Map<number, Strategy>();
  strategiesList.forEach(s => strategiesById.set(s.id, s));

  const tradesByKey = new Map<string, Trade>();
  const tradesByCode = new Map<number, Trade>();
  (trades || []).forEach(tr => {
    if (tr.unique_key) tradesByKey.set(normalizeUniqueKey(tr.unique_key), tr);
    if (tr.trade_code !== null && tr.trade_code !== undefined) {
      tradesByCode.set(Number(tr.trade_code), tr);
    }
  });

  const txsByKey = new Map<string, Transaction[]>();
  (transactions || []).forEach(tx => {
    const nk = normalizeUniqueKey(tx.unique_key);
    const arr = txsByKey.get(nk) || [];
    arr.push(tx);
    txsByKey.set(nk, arr);
  });

  // Mapa acumulador por nombre de estrategia
  const strategyBuckets = new Map<string, { stock: number; call: number; put: number }>();

  // Pre-cargar todas las estrategias activas para asegurar su presencia en la tabla
  strategiesList.forEach(s => {
    if (!strategyBuckets.has(s.name)) {
      strategyBuckets.set(s.name, { stock: 0, call: 0, put: 0 });
    }
  });

  // Clasificar y sumar cada posición
  for (const pos of positions) {
    const stratName = resolverEstrategiaDePosicion(pos, tradesByKey, tradesByCode, txsByKey, strategiesById);
    if (!strategyBuckets.has(stratName)) {
      strategyBuckets.set(stratName, { stock: 0, call: 0, put: 0 });
    }
    const bucket = strategyBuckets.get(stratName)!;
    const netLiq = typeof pos.net_liq === 'number' && !isNaN(pos.net_liq) ? pos.net_liq : 0;
    const tipo = clasificarTipoInstrumento(pos.unique_key);

    if (tipo === 'CALL') {
      bucket.call += netLiq;
    } else if (tipo === 'PUT') {
      bucket.put += netLiq;
    } else {
      bucket.stock += netLiq;
    }
  }

  let totalStockValue = 0;
  let totalCallValue = 0;
  let totalPutValue = 0;

  for (const bucket of strategyBuckets.values()) {
    totalStockValue += bucket.stock;
    totalCallValue += bucket.call;
    totalPutValue += bucket.put;
  }

  const safeCashBalance = typeof cashBalance === 'number' && !isNaN(cashBalance) ? cashBalance : 0;
  const totalPortfolioValue = totalStockValue + totalCallValue + totalPutValue + safeCashBalance;

  // Construir filas ordenadas por nombre de estrategia
  const rows: AssetAllocationRow[] = Array.from(strategyBuckets.entries())
    .map(([stratName, bucket]) => {
      const rowPortfolioValue = bucket.stock + bucket.call + bucket.put;
      const allocationPct = totalPortfolioValue > 0 ? (rowPortfolioValue / totalPortfolioValue) * 100 : 0;

      return {
        strategy: stratName,
        stockValue: Number(bucket.stock.toFixed(2)),
        callValue: Number(bucket.call.toFixed(2)),
        putValue: Number(bucket.put.toFixed(2)),
        cashBalance: 0,
        portfolioValue: Number(rowPortfolioValue.toFixed(2)),
        allocationPct: Number(allocationPct.toFixed(2))
      };
    })
    .sort((a, b) => {
      // Poner Unassigned al final
      if (a.strategy === 'Unassigned') return 1;
      if (b.strategy === 'Unassigned') return -1;
      return a.strategy.localeCompare(b.strategy);
    });

  const stockPct = totalPortfolioValue > 0 ? (totalStockValue / totalPortfolioValue) * 100 : 0;
  const callPct = totalPortfolioValue > 0 ? (totalCallValue / totalPortfolioValue) * 100 : 0;
  const putPct = totalPortfolioValue > 0 ? (totalPutValue / totalPortfolioValue) * 100 : 0;
  const cashPct = totalPortfolioValue > 0 ? (safeCashBalance / totalPortfolioValue) * 100 : 0;

  return {
    rows,
    totalStockValue: Number(totalStockValue.toFixed(2)),
    totalCallValue: Number(totalCallValue.toFixed(2)),
    totalPutValue: Number(totalPutValue.toFixed(2)),
    totalCashBalance: Number(safeCashBalance.toFixed(2)),
    totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
    stockPct: Number(stockPct.toFixed(2)),
    callPct: Number(callPct.toFixed(2)),
    putPct: Number(putPct.toFixed(2)),
    cashPct: Number(cashPct.toFixed(2))
  };
};

/**
 * 2. TABLA DE P&L POR ESTRATEGIA (Closed P&L vs Open P&L)
 * Fórmulas:
 * - Estrategias excluidas: Short Mean Reversion, Short RSI Thrust, MA Cross -Long, MA Cross -Short, Hedge
 * - Closed P&L: Suma de amount de las transacciones cerradas (status === 'Closed') agrupadas por trade_code
 * - Open P&L: Por cada símbolo abierto: CashFlows_abiertos (suma de amount) + MarketValue_actual (positions.net_liq)
 * - Total P&L: Closed P&L + Open P&L
 */
export const calcularStrategyPnL = (
  transactions: Transaction[],
  positions: Position[],
  trades?: Trade[]
): StrategyPnLSummary => {
  const tradesByCode = new Map<number, Trade>();
  const tradesByKey = new Map<string, Trade>();
  (trades || []).forEach(tr => {
    if (tr.trade_code !== null && tr.trade_code !== undefined) {
      tradesByCode.set(Number(tr.trade_code), tr);
    }
    if (tr.unique_key) {
      tradesByKey.set(normalizeUniqueKey(tr.unique_key), tr);
    }
  });

  // Agrupador por estrategia
  const strategyMap = new Map<string, { closedPnL: number; openPnL: number }>();

  const getOrCreateStrategy = (name: string) => {
    if (!strategyMap.has(name)) {
      strategyMap.set(name, { closedPnL: 0, openPnL: 0 });
    }
    return strategyMap.get(name)!;
  };

  // --- 1. CLOSED P&L: Transacciones de trades cerrados agrupadas por trade_code ---
  const txsByTradeCode = new Map<number, Transaction[]>();
  for (const tx of transactions) {
    if (tx.trade_code !== null && tx.trade_code !== undefined && !isNaN(Number(tx.trade_code))) {
      const code = Number(tx.trade_code);
      const list = txsByTradeCode.get(code) || [];
      list.push(tx);
      txsByTradeCode.set(code, list);
    }
  }

  for (const [code, txs] of txsByTradeCode.entries()) {
    const tr = tradesByCode.get(code);
    const isClosed = tr ? tr.status === 'Closed' : txs.every(t => (t.position_status || '').toLowerCase() === 'closed');

    if (isClosed) {
      const stratName = tr?.strategies?.name || txs.find(t => t.strategies?.name)?.strategies?.name || txs.find(t => t.strategy)?.strategy || 'Unassigned';

      if (!isExcludedStrategy(stratName)) {
        const tradePnL = txs.reduce((sum, t) => sum + (typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0), 0);
        const item = getOrCreateStrategy(stratName);
        item.closedPnL += tradePnL;
      }
    }
  }

  // --- 2. OPEN P&L: Por cada símbolo/trade abierto ---
  // Cash flows de transacciones abiertas agrupados por symbol/unique_key
  const openTxsBySymbol = new Map<string, { amountSum: number; stratName: string; tradeCode: number | null }>();
  for (const tx of transactions) {
    const tr = tx.trade_code ? tradesByCode.get(Number(tx.trade_code)) : undefined;
    const isOpen = tr ? tr.status === 'Open' : (tx.position_status || '').toLowerCase() === 'open';

    if (isOpen) {
      const sym = (tx.symbol || '').trim().toUpperCase();
      const stratName = tr?.strategies?.name || tx.strategies?.name || tx.strategy || 'Unassigned';
      const existing = openTxsBySymbol.get(sym) || { amountSum: 0, stratName, tradeCode: tx.trade_code ? Number(tx.trade_code) : null };
      existing.amountSum += typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0;
      if (stratName !== 'Unassigned') existing.stratName = stratName;
      openTxsBySymbol.set(sym, existing);
    }
  }

  // Market Value actual (positions.net_liq) agrupado por symbol
  const openMarketValueBySymbol = new Map<string, { netLiqSum: number; stratName: string }>();
  for (const pos of positions) {
    const sym = (pos.symbol || '').trim().toUpperCase();
    const netLiq = typeof pos.net_liq === 'number' && !isNaN(pos.net_liq) ? pos.net_liq : 0;
    const normKey = normalizeUniqueKey(pos.unique_key);
    const tr = tradesByKey.get(normKey);
    const stratName = tr?.strategies?.name || 'Unassigned';

    const existing = openMarketValueBySymbol.get(sym) || { netLiqSum: 0, stratName };
    existing.netLiqSum += netLiq;
    if (stratName !== 'Unassigned') existing.stratName = stratName;
    openMarketValueBySymbol.set(sym, existing);
  }

  // Unir todos los símbolos que tienen transacciones abiertas o posiciones abiertas
  const allOpenSymbols = new Set<string>([
    ...Array.from(openTxsBySymbol.keys()),
    ...Array.from(openMarketValueBySymbol.keys())
  ]);

  for (const sym of allOpenSymbols) {
    const txData = openTxsBySymbol.get(sym);
    const posData = openMarketValueBySymbol.get(sym);

    const stratName = (posData?.stratName && posData.stratName !== 'Unassigned')
      ? posData.stratName
      : (txData?.stratName || 'Unassigned');

    if (!isExcludedStrategy(stratName)) {
      const cashFlow = txData ? txData.amountSum : 0;
      const marketVal = posData ? posData.netLiqSum : 0;
      const openPnL = cashFlow + marketVal;

      const item = getOrCreateStrategy(stratName);
      item.openPnL += openPnL;
    }
  }

  let totalClosedPnL = 0;
  let totalOpenPnL = 0;

  const rows: StrategyPnLRow[] = Array.from(strategyMap.entries())
    .map(([stratName, values]) => {
      const rowTotalPnL = values.closedPnL + values.openPnL;
      totalClosedPnL += values.closedPnL;
      totalOpenPnL += values.openPnL;

      return {
        strategy: stratName,
        closedPnL: Number(values.closedPnL.toFixed(2)),
        openPnL: Number(values.openPnL.toFixed(2)),
        totalPnL: Number(rowTotalPnL.toFixed(2))
      };
    })
    .sort((a, b) => b.totalPnL - a.totalPnL);

  const grandTotalPnL = totalClosedPnL + totalOpenPnL;

  return {
    rows,
    totalClosedPnL: Number(totalClosedPnL.toFixed(2)),
    totalOpenPnL: Number(totalOpenPnL.toFixed(2)),
    grandTotalPnL: Number(grandTotalPnL.toFixed(2))
  };
};

/**
 * Función pura auxiliar para calcular las métricas estadísticas a partir de una lista de PnLs de trades
 */
export const calcularMetricasColumna = (pnlList: number[]): AuditMetricColumn => {
  if (!pnlList || pnlList.length === 0) {
    return {
      averageWinner: 0,
      averageLoser: 0,
      winLossRatio: 0,
      winRatePct: 0,
      expectancy: 0,
      quantity: 0,
      totalPnL: 0
    };
  }

  const quantity = pnlList.length;
  const winners = pnlList.filter(p => p > 0);
  const losers = pnlList.filter(p => p < 0);

  const sumWinners = winners.reduce((a, b) => a + b, 0);
  const sumLosers = losers.reduce((a, b) => a + b, 0);
  const totalPnL = pnlList.reduce((a, b) => a + b, 0);

  const averageWinner = winners.length > 0 ? sumWinners / winners.length : 0;
  const averageLoser = losers.length > 0 ? sumLosers / losers.length : 0;

  const winRateFraction = quantity > 0 ? winners.length / quantity : 0;
  const winRatePct = winRateFraction * 100;

  // Win/Loss Ratio ($): Average Winner / |Average Loser|
  const absAvgLoser = Math.abs(averageLoser);
  let winLossRatio = 0;
  if (absAvgLoser > 0) {
    winLossRatio = averageWinner / absAvgLoser;
  } else if (averageWinner > 0) {
    winLossRatio = averageWinner; // Si no hay perdedores, ratio positivo
  }

  // Expectancy: (Win Rate * Win/Loss Ratio) - (1 - Win Rate)
  const lossRateFraction = 1 - winRateFraction;
  const expectancy = (winRateFraction * winLossRatio) - lossRateFraction;

  return {
    averageWinner: Number(averageWinner.toFixed(2)),
    averageLoser: Number(averageLoser.toFixed(2)),
    winLossRatio: Number(winLossRatio.toFixed(2)),
    winRatePct: Number(winRatePct.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    quantity,
    totalPnL: Number(totalPnL.toFixed(2))
  };
};

/**
 * 3. TABLA DE MÉTRICAS ESTADÍSTICAS DE RENDIMIENTO (Audit Metrics)
 * Columnas: Metric | Closed | Open | Overall
 * Filas: Average Winner, Average Loser, Win/Loss Ratio ($), Win Rate %, Expectancy, Quantity, P&L
 */
export const calcularAuditMetrics = (
  transactions: Transaction[],
  positions: Position[],
  trades?: Trade[]
): AuditMetricsSummary => {
  const tradesByCode = new Map<number, Trade>();
  const tradesByKey = new Map<string, Trade>();
  (trades || []).forEach(tr => {
    if (tr.trade_code !== null && tr.trade_code !== undefined) {
      tradesByCode.set(Number(tr.trade_code), tr);
    }
    if (tr.unique_key) {
      tradesByKey.set(normalizeUniqueKey(tr.unique_key), tr);
    }
  });

  // 1. PnLs de Trades Cerrados
  const txsByTradeCode = new Map<number, Transaction[]>();
  for (const tx of transactions) {
    if (tx.trade_code !== null && tx.trade_code !== undefined && !isNaN(Number(tx.trade_code))) {
      const code = Number(tx.trade_code);
      const list = txsByTradeCode.get(code) || [];
      list.push(tx);
      txsByTradeCode.set(code, list);
    }
  }

  const closedPnLList: number[] = [];
  for (const [code, txs] of txsByTradeCode.entries()) {
    const tr = tradesByCode.get(code);
    const isClosed = tr ? tr.status === 'Closed' : txs.every(t => (t.position_status || '').toLowerCase() === 'closed');

    if (isClosed) {
      const stratName = tr?.strategies?.name || txs.find(t => t.strategies?.name)?.strategies?.name || txs.find(t => t.strategy)?.strategy || 'Unassigned';
      if (!isExcludedStrategy(stratName)) {
        const tradePnL = txs.reduce((sum, t) => sum + (typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0), 0);
        closedPnLList.push(tradePnL);
      }
    }
  }

  // 2. PnLs de Trades Abiertos
  const openTxsBySymbol = new Map<string, { amountSum: number; stratName: string }>();
  for (const tx of transactions) {
    const tr = tx.trade_code ? tradesByCode.get(Number(tx.trade_code)) : undefined;
    const isOpen = tr ? tr.status === 'Open' : (tx.position_status || '').toLowerCase() === 'open';

    if (isOpen) {
      const sym = (tx.symbol || '').trim().toUpperCase();
      const stratName = tr?.strategies?.name || tx.strategies?.name || tx.strategy || 'Unassigned';
      const existing = openTxsBySymbol.get(sym) || { amountSum: 0, stratName };
      existing.amountSum += typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0;
      if (stratName !== 'Unassigned') existing.stratName = stratName;
      openTxsBySymbol.set(sym, existing);
    }
  }

  const openMarketValueBySymbol = new Map<string, { netLiqSum: number; stratName: string }>();
  for (const pos of positions) {
    const sym = (pos.symbol || '').trim().toUpperCase();
    const netLiq = typeof pos.net_liq === 'number' && !isNaN(pos.net_liq) ? pos.net_liq : 0;
    const normKey = normalizeUniqueKey(pos.unique_key);
    const tr = tradesByKey.get(normKey);
    const stratName = tr?.strategies?.name || 'Unassigned';

    const existing = openMarketValueBySymbol.get(sym) || { netLiqSum: 0, stratName };
    existing.netLiqSum += netLiq;
    if (stratName !== 'Unassigned') existing.stratName = stratName;
    openMarketValueBySymbol.set(sym, existing);
  }

  const allOpenSymbols = new Set<string>([
    ...Array.from(openTxsBySymbol.keys()),
    ...Array.from(openMarketValueBySymbol.keys())
  ]);

  const openPnLList: number[] = [];
  for (const sym of allOpenSymbols) {
    const txData = openTxsBySymbol.get(sym);
    const posData = openMarketValueBySymbol.get(sym);

    const stratName = (posData?.stratName && posData.stratName !== 'Unassigned')
      ? posData.stratName
      : (txData?.stratName || 'Unassigned');

    if (!isExcludedStrategy(stratName)) {
      const cashFlow = txData ? txData.amountSum : 0;
      const marketVal = posData ? posData.netLiqSum : 0;
      const openPnL = cashFlow + marketVal;
      openPnLList.push(openPnL);
    }
  }

  // 3. Overall = Closed + Open combinados
  const overallPnLList = [...closedPnLList, ...openPnLList];

  return {
    closed: calcularMetricasColumna(closedPnLList),
    open: calcularMetricasColumna(openPnLList),
    overall: calcularMetricasColumna(overallPnLList)
  };
};

/**
 * 4. TABLA DE RIESGO & MÚLTIPLOS R (Risk Strategies - Trades Cerrados)
 * Columnas: Strategy | Total P&L ($) | Initial Investment ($) | R
 * Lógica:
 * - Trades cerrados estrictamente (status === 'Closed')
 * - Initial Investment ($): Desembolso inicial de la primera compra cronológica (Buy to Open o Buy, o primer movimiento en valor absoluto)
 * - R: Total P&L / Initial Investment
 * - Fila final: Total / Portfolio con el R global
 * - KPIs destacados: Closed Trades (conteo) e Inversión Inicial Promedio ($)
 */
export const calcularRiskMultiples = (
  transactions: Transaction[],
  trades?: Trade[]
): RiskMultiplesSummary => {
  const tradesByCode = new Map<number, Trade>();
  (trades || []).forEach(tr => {
    if (tr.trade_code !== null && tr.trade_code !== undefined) {
      tradesByCode.set(Number(tr.trade_code), tr);
    }
  });

  const txsByTradeCode = new Map<number, Transaction[]>();
  for (const tx of transactions) {
    if (tx.trade_code !== null && tx.trade_code !== undefined && !isNaN(Number(tx.trade_code))) {
      const code = Number(tx.trade_code);
      const list = txsByTradeCode.get(code) || [];
      list.push(tx);
      txsByTradeCode.set(code, list);
    }
  }

  // Agrupador por estrategia
  const strategyRiskMap = new Map<string, { totalPnL: number; initialInvestment: number }>();

  let closedTradesCount = 0;

  for (const [code, txs] of txsByTradeCode.entries()) {
    const tr = tradesByCode.get(code);
    const isClosed = tr ? tr.status === 'Closed' : txs.every(t => (t.position_status || '').toLowerCase() === 'closed');

    if (isClosed) {
      const stratName = tr?.strategies?.name || txs.find(t => t.strategies?.name)?.strategies?.name || txs.find(t => t.strategy)?.strategy || 'Unassigned';

      if (!isExcludedStrategy(stratName)) {
        closedTradesCount++;

        // 1. Calcular Total P&L del trade (suma de amount de todas sus transacciones)
        const tradePnL = txs.reduce((sum, t) => sum + (typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0), 0);

        // 2. Calcular Inversión Inicial: Desembolso inicial de la primera compra cronológica
        // Ordenar transacciones por fecha ascendente
        const sortedTxs = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Buscar primera compra cronológica ('Buy', 'Buy to Open' o amount negativo)
        const firstBuyTx = sortedTxs.find(t => {
          const act = (t.action || '').toLowerCase();
          return act.includes('buy') || (typeof t.amount === 'number' && t.amount < 0);
        }) || sortedTxs[0];

        let tradeInitialInvestment = 0;
        if (firstBuyTx) {
          if (typeof firstBuyTx.amount === 'number' && firstBuyTx.amount !== 0) {
            tradeInitialInvestment = Math.abs(firstBuyTx.amount);
          } else if (typeof firstBuyTx.price === 'number' && typeof firstBuyTx.quantity === 'number') {
            const multiplier = firstBuyTx.instrument === 'Option' ? 100 : 1;
            tradeInitialInvestment = Math.abs(firstBuyTx.price * firstBuyTx.quantity * multiplier);
          }
        }

        if (!strategyRiskMap.has(stratName)) {
          strategyRiskMap.set(stratName, { totalPnL: 0, initialInvestment: 0 });
        }
        const item = strategyRiskMap.get(stratName)!;
        item.totalPnL += tradePnL;
        item.initialInvestment += tradeInitialInvestment;
      }
    }
  }

  let totalPnL = 0;
  let totalInitialInvestment = 0;

  const rows: RiskStrategyRow[] = Array.from(strategyRiskMap.entries())
    .map(([stratName, val]) => {
      totalPnL += val.totalPnL;
      totalInitialInvestment += val.initialInvestment;
      const rMultiple = val.initialInvestment > 0 ? (val.totalPnL / val.initialInvestment) : 0;

      return {
        strategy: stratName,
        totalPnL: Number(val.totalPnL.toFixed(2)),
        initialInvestment: Number(val.initialInvestment.toFixed(2)),
        rMultiple: Number(rMultiple.toFixed(2))
      };
    })
    .sort((a, b) => b.totalPnL - a.totalPnL);

  const portfolioR = totalInitialInvestment > 0 ? (totalPnL / totalInitialInvestment) : 0;
  const averageInitialInvestment = closedTradesCount > 0 ? (totalInitialInvestment / closedTradesCount) : 0;

  return {
    rows,
    totalPnL: Number(totalPnL.toFixed(2)),
    totalInitialInvestment: Number(totalInitialInvestment.toFixed(2)),
    portfolioR: Number(portfolioR.toFixed(2)),
    closedTradesCount,
    averageInitialInvestment: Number(averageInitialInvestment.toFixed(2))
  };
};

/**
 * Función principal unificada que genera todos los datos requeridos por el Centro de Control Ejecutivo
 */
export const calcularExecutiveDashboard = (
  positions: Position[],
  transactions: Transaction[],
  strategies: Strategy[],
  trades?: Trade[],
  cashBalance: number = 0
): ExecutiveDashboardData => {
  return {
    assetAllocation: calcularAssetAllocation(positions, strategies, trades, transactions, cashBalance),
    strategyPnL: calcularStrategyPnL(transactions, positions, trades),
    auditMetrics: calcularAuditMetrics(transactions, positions, trades),
    riskMultiples: calcularRiskMultiples(transactions, trades)
  };
};
