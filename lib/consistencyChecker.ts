// lib/consistencyChecker.ts

import { 
  Position, 
  Transaction, 
  Trade, 
  Strategy, 
  MkTosQuote, 
  SpyDailyClose,
  ConsistencyIssue,
  ConsistencyAuditResult,
  ConsistencySeverity
} from '../types';
import { normalizeUniqueKey } from './formatters';
import { calcularCurrentQuantityDesdeTransacciones } from './transactionsParser';

export interface ConsistencyAuditParams {
  positions: Position[];
  transactions: Transaction[];
  trades: Trade[];
  strategies?: Strategy[];
  mkTosQuotes?: MkTosQuote[];
  spyCloses?: SpyDailyClose[];
}

/**
 * Pure domain audit function that verifies full cross-consistency between:
 * 1. ThinkorSwim Positions Statement
 * 2. Transactions & Master Trades
 * 3. Strategy Assignments
 * 4. Technical Quotes (MK-TOS & SPY)
 *
 * Adheres strictly to Clean Architecture (zero network or database calls).
 */
export function auditPortfolioConsistency({
  positions,
  transactions,
  trades,
  strategies = [],
  mkTosQuotes = [],
  spyCloses = []
}: ConsistencyAuditParams): ConsistencyAuditResult {
  const issues: ConsistencyIssue[] = [];

  // 1. Index MK-TOS Quotes by Symbol
  const quotesBySymbol = new Map<string, MkTosQuote>();
  for (const q of mkTosQuotes || []) {
    if (q.symbol) {
      quotesBySymbol.set(q.symbol.trim().toUpperCase(), q);
    }
  }

  // Check if SPY is available
  const hasSpyQuote = quotesBySymbol.has('SPY') || (spyCloses && spyCloses.length > 0);

  // 2. Index Strategies by ID
  const strategiesById = new Map<number, Strategy>();
  for (const st of strategies || []) {
    strategiesById.set(st.id, st);
  }

  // 3. Index Transactions by trade_code and normalized unique_key
  const txsByTradeCode = new Map<number, Transaction[]>();
  const txsByNormKey = new Map<string, Transaction[]>();
  for (const tx of transactions || []) {
    if (tx.trade_code !== null && tx.trade_code !== undefined) {
      const tc = Number(tx.trade_code);
      if (!isNaN(tc) && tc > 0) {
        if (!txsByTradeCode.has(tc)) txsByTradeCode.set(tc, []);
        txsByTradeCode.get(tc)!.push(tx);
      }
    }
    if (tx.unique_key) {
      const nk = normalizeUniqueKey(tx.unique_key);
      if (nk) {
        if (!txsByNormKey.has(nk)) txsByNormKey.set(nk, []);
        txsByNormKey.get(nk)!.push(tx);
      }
    }
  }

  // 4. Index Trades
  const tradesByCode = new Map<number, Trade>();
  const tradesByKey = new Map<string, Trade>();
  const openTradesBySymbol = new Map<string, Trade>();
  const openTradeByTxKey = new Map<string, Trade>();

  for (const tr of trades || []) {
    const code = Number(tr.trade_code);
    if (!isNaN(code) && code > 0) {
      tradesByCode.set(code, tr);
    }

    const isOpen = (tr.status || '').toLowerCase() === 'open';
    if (tr.unique_key) {
      const nk = normalizeUniqueKey(tr.unique_key);
      if (nk) {
        const existing = tradesByKey.get(nk);
        const existingIsOpen = existing && (existing.status || '').toLowerCase() === 'open';
        if (!existing || (!existingIsOpen && isOpen)) {
          tradesByKey.set(nk, tr);
        }
      }
    }

    if (tr.symbol && isOpen) {
      const sym = tr.symbol.trim().toUpperCase();
      if (!openTradesBySymbol.has(sym)) {
        openTradesBySymbol.set(sym, tr);
      }
    }

    // Index open trade by transaction keys if open
    if (isOpen && code > 0) {
      const txs = txsByTradeCode.get(code) || [];
      for (const t of txs) {
        if (t.unique_key) {
          const tKey = normalizeUniqueKey(t.unique_key);
          if (tKey && !openTradeByTxKey.has(tKey)) {
            openTradeByTxKey.set(tKey, tr);
          }
        }
      }
    }
  }

  // 5. Index Positions and Track Matches
  const positionsByKey = new Map<string, Position>();
  const positionsBySymbol = new Map<string, Position[]>();
  const matchedTradeCodes = new Set<number>();
  const matchedPositionIds = new Set<string>();

  for (const pos of positions || []) {
    if (!pos.unique_key) continue;
    const nk = normalizeUniqueKey(pos.unique_key);
    positionsByKey.set(nk, pos);

    const sym = (pos.symbol || '').trim().toUpperCase();
    if (sym) {
      if (!positionsBySymbol.has(sym)) positionsBySymbol.set(sym, []);
      positionsBySymbol.get(sym)!.push(pos);
    }
  }

  // =========================================================================
  // CHECK 1: POSITIONS AUDIT (Orphan Positions, Quantity Mismatch, Missing Strategy, Missing Quote)
  // =========================================================================
  let checkedSpyForWeekend = false;

  for (const pos of positions || []) {
    if (pos.quantity === 0) continue;

    const posNormKey = normalizeUniqueKey(pos.unique_key);
    const posSym = (pos.symbol || '').trim().toUpperCase();

    // Find matching Trade
    const matchedTrade = tradesByKey.get(posNormKey)
      || openTradeByTxKey.get(posNormKey)
      || (posSym ? openTradesBySymbol.get(posSym) : undefined);

    if (!matchedTrade) {
      // ORPHAN POSITION: Active in broker statement, but no Trade/Transactions in system
      issues.push({
        id: `orphan-${pos.id || pos.unique_key}`,
        type: 'ORPHAN_POSITION',
        severity: 'red',
        symbol: pos.symbol,
        unique_key: pos.unique_key,
        positionQuantity: pos.quantity,
        title: 'Orphan Position',
        description: `Position ${pos.symbol} (Qty: ${pos.quantity}) exists in ThinkorSwim, but has no matching Trade or Transactions in the system.`,
        impact: 'Missing entry price, trade code, and strategy. It cannot be monitored in Strategies Stops.',
        suggestedAction: 'Upload the Transactions file containing the entry orders for this position.'
      });
      continue;
    }

    // Record trade match
    matchedPositionIds.add(pos.id || pos.unique_key);
    if (matchedTrade.trade_code) {
      matchedTradeCodes.add(Number(matchedTrade.trade_code));
    }

    // Determine trade quantity
    const tradeCode = Number(matchedTrade.trade_code);
    const txsForTrade = txsByTradeCode.get(tradeCode) || [];
    const recordedQty = (matchedTrade.current_quantity !== null && matchedTrade.current_quantity !== undefined)
      ? Number(matchedTrade.current_quantity)
      : calcularCurrentQuantityDesdeTransacciones(txsForTrade);

    // CHECK QUANTITY MISMATCH
    if (Math.abs(pos.quantity - recordedQty) > 0.0001) {
      issues.push({
        id: `mismatch-${tradeCode}-${pos.symbol}`,
        type: 'QUANTITY_MISMATCH',
        severity: 'red',
        trade_code: tradeCode,
        symbol: pos.symbol,
        unique_key: pos.unique_key,
        instrument: matchedTrade.instrument,
        positionQuantity: pos.quantity,
        tradeQuantity: recordedQty,
        title: 'Quantity Mismatch',
        description: `Positions Statement reports ${pos.quantity} for ${pos.symbol}, but Trade #${tradeCode} records ${recordedQty}.`,
        impact: 'Portfolio sizing, exposure, and risk allocations are desynchronized.',
        suggestedAction: 'Verify if a partial fill, exit order, or rollover transaction is missing.'
      });
    }

    // CHECK MISSING STRATEGY
    const strategyName = matchedTrade.strategies?.name
      || (matchedTrade.strategy_id ? strategiesById.get(matchedTrade.strategy_id)?.name : null)
      || (txsForTrade.length > 0 ? (txsForTrade[0].strategies?.name || txsForTrade[0].strategy) : null);

    const isMissingStrategy = !strategyName
      || strategyName.trim() === ''
      || strategyName.trim().toUpperCase() === 'S/D'
      || strategyName.trim() === '-';

    if (isMissingStrategy) {
      issues.push({
        id: `missing-strat-${tradeCode}-${pos.symbol}`,
        type: 'MISSING_STRATEGY',
        severity: 'yellow',
        trade_code: tradeCode,
        symbol: pos.symbol,
        unique_key: pos.unique_key,
        instrument: matchedTrade.instrument,
        title: 'Missing Strategy',
        description: `Position ${pos.symbol} (Trade #${tradeCode}) has no assigned strategy (currently 'S/D').`,
        impact: 'Strategy Stop formulas (Tech Trader, 20% Flipper, etc.) cannot be determined.',
        suggestedAction: 'Assign an active trading strategy in the Transactions module or trades review modal.'
      });
    } else {
      // CHECK MISSING MK-TOS QUOTE (only if strategy is defined)
      if (mkTosQuotes && mkTosQuotes.length > 0 && !quotesBySymbol.has(posSym)) {
        issues.push({
          id: `missing-quote-${tradeCode}-${pos.symbol}`,
          type: 'MISSING_MKTOS_QUOTE',
          severity: 'yellow',
          trade_code: tradeCode,
          symbol: pos.symbol,
          unique_key: pos.unique_key,
          instrument: matchedTrade.instrument,
          title: 'Missing Technical Quote',
          description: `Symbol ${pos.symbol} was not found in the latest active MK-TOS Quotes file.`,
          impact: 'The stop displays as "Review" and cannot trail technical indicators (EMA, Highs).',
          suggestedAction: `Upload an MK-TOS quotes file that includes ${pos.symbol}.`
        });
      }

      // Check Weekend Trader SPY dependency
      const isWeekend = strategyName.toLowerCase().includes('weekend') || matchedTrade.weekend_trader_flag === true;
      if (isWeekend && !hasSpyQuote && !checkedSpyForWeekend) {
        checkedSpyForWeekend = true;
        issues.push({
          id: `missing-spy-${tradeCode}`,
          type: 'MISSING_MKTOS_QUOTE',
          severity: 'yellow',
          trade_code: tradeCode,
          symbol: 'SPY',
          title: 'Missing SPY Weekly Quote',
          description: 'SPY ETF quotes are missing from MK-TOS. Weekend Trader market regime (Bullish vs Bearish) cannot be determined.',
          impact: 'Weekend Trader stops may fall back or require manual review.',
          suggestedAction: 'Ensure MK-TOS quotes files contain the SPY ticker.'
        });
      }
    }
  }

  // =========================================================================
  // CHECK 2: TRADES AUDIT (Ghost Open Trades)
  // =========================================================================
  for (const trade of trades || []) {
    const isOpen = (trade.status || '').toLowerCase() === 'open';
    if (!isOpen) continue;

    const tradeCode = Number(trade.trade_code);
    if (isNaN(tradeCode) || tradeCode <= 0) continue;

    // Skip if already matched to an active position
    if (matchedTradeCodes.has(tradeCode)) continue;

    const txsForTrade = txsByTradeCode.get(tradeCode) || [];
    const netQty = (trade.current_quantity !== null && trade.current_quantity !== undefined)
      ? Number(trade.current_quantity)
      : calcularCurrentQuantityDesdeTransacciones(txsForTrade);

    // Only flag as Ghost Trade if it holds positive open quantity in the system
    if (netQty > 0.0001) {
      const tradeNormKey = normalizeUniqueKey(trade.unique_key);
      const tradeSym = (trade.symbol || '').trim().toUpperCase();

      // Check if any position matches by key or symbol
      const hasPosMatch = (tradeNormKey && positionsByKey.has(tradeNormKey))
        || (trade.instrument === 'Stock' && tradeSym && positionsBySymbol.has(tradeSym))
        || txsForTrade.some(t => t.unique_key && positionsByKey.has(normalizeUniqueKey(t.unique_key)));

      if (!hasPosMatch) {
        issues.push({
          id: `ghost-${tradeCode}-${trade.symbol}`,
          type: 'GHOST_OPEN_TRADE',
          severity: 'red',
          trade_code: tradeCode,
          symbol: trade.symbol,
          unique_key: trade.unique_key,
          instrument: trade.instrument,
          tradeQuantity: netQty,
          title: 'Ghost Open Trade',
          description: `Trade #${tradeCode} (${trade.symbol}) is marked as Open (Qty: +${netQty}) in the system, but does NOT appear in the latest Positions Statement.`,
          impact: 'This trade is completely hidden from Strategies Stops and its stop is not monitored.',
          suggestedAction: 'If closed or expired in ThinkorSwim, close the trade or import the closing transaction.'
        });
      }
    }
  }

  // Sort issues: Red first, then Yellow, then by Trade Code / Symbol
  issues.sort((a, b) => {
    if (a.severity === 'red' && b.severity !== 'red') return -1;
    if (a.severity !== 'red' && b.severity === 'red') return 1;
    const codeA = a.trade_code || 0;
    const codeB = b.trade_code || 0;
    if (codeA !== codeB) return codeB - codeA;
    return a.symbol.localeCompare(b.symbol);
  });

  const redCount = issues.filter(i => i.severity === 'red').length;
  const yellowCount = issues.filter(i => i.severity === 'yellow').length;
  const maxSeverity: ConsistencySeverity | null = redCount > 0 ? 'red' : yellowCount > 0 ? 'yellow' : null;

  return {
    hasIssues: issues.length > 0,
    maxSeverity,
    redCount,
    yellowCount,
    totalCount: issues.length,
    issues,
    auditedAt: new Date().toISOString()
  };
}
