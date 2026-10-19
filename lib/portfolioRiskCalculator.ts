// lib/portfolioRiskCalculator.ts

import {
  Position,
  Transaction,
  MkTosQuote,
  Trade,
  Strategy,
  SpyDailyClose,
  PortfolioRiskResult,
  PositionRiskItem,
  StrategyRiskSummary,
  MarketDropLevel,
  ConsolidatedStrategyStop
} from '../types';
import { consolidarStrategiesStops } from './strategiesCalculator';

/**
 * Función pura de dominio que calcula el riesgo monetario en dólares al stop
 * y la curva de absorción de stop-loss ante caídas del mercado (0% a 50%).
 * 
 * Basada en los algoritmos y modelos de The Closing Bell:
 * - 02. -Portfolio_Risk_Analysis.py
 * - 03. -Stop-loss_Curve_Analysis.py
 */
export function calcularPortfolioRisk(
  positions: Position[],
  transactions: Transaction[],
  mkTosQuotes?: MkTosQuote[],
  trades?: Trade[],
  strategies?: Strategy[],
  spyCloses?: SpyDailyClose[]
): PortfolioRiskResult {
  if (!positions || positions.length === 0) {
    return {
      summaries: [],
      positions: [],
      drops: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map(dropPct => ({
        dropPct,
        remainingCapital: 0,
        stoppedOutCapital: 0,
        stoppedPositionsCount: 0
      })),
      totalCapital: 0,
      totalRisk: 0,
      overallRiskPct: 0
    };
  }

  // 1. Reutilizar consolidarStrategiesStops para obtener trade, estrategia y stopValue
  const consolidado: ConsolidatedStrategyStop[] = consolidarStrategiesStops(
    positions,
    transactions,
    mkTosQuotes,
    trades,
    strategies,
    spyCloses
  );

  // Mapear consolidado por id de posición para correlación segura
  const consolidadoById = new Map<string, ConsolidatedStrategyStop>();
  for (const c of consolidado) {
    if (c.id) {
      consolidadoById.set(c.id, c);
    }
  }

  interface RawRiskItem {
    id: string;
    trade_code: string;
    symbol: string;
    strategy: string;
    currentPrice: number;
    stopPrice: number;
    distancePct: number;
    positionAmount: number;
    scenarioLoss: number;
    needsReview?: boolean;
    reviewReason?: string;
  }

  const rawItems: RawRiskItem[] = [];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const cItem = (pos.id && consolidadoById.get(pos.id)) || consolidado[i];
    const id = pos.id || `${cItem?.trade_code || pos.unique_key || 'pos'}-${pos.symbol || 'sym'}-${i}`;

    // Código y Símbolo
    const trade_code = cItem?.trade_code && cItem.trade_code !== '-' ? cItem.trade_code : (pos.unique_key || '-');
    const symbol = pos.symbol || cItem?.symbol || 'UNKNOWN';
    const strategy = cItem?.strategy || 'S/D';
    const normStrategy = strategy.toLowerCase().trim();

    // Las coberturas (Hedges) se analizan en su propio módulo /dashboard/hedging y no tienen stop-loss direccional
    if (normStrategy.includes('hedge')) {
      continue;
    }

    // Precio actual
    const currentPrice = (cItem?.lastPrice && cItem.lastPrice > 0)
      ? cItem.lastPrice
      : ((pos.stock_last && pos.stock_last > 0) ? pos.stock_last : (pos.stock_mark && pos.stock_mark > 0 ? pos.stock_mark : 0));

    // Stop Price
    let stopPrice = 0;
    const isMACStrategy = normStrategy.includes('mac');
    const isTrendPilotStrategy = normStrategy.includes('pilot') || normStrategy.includes('trend');

    if (isMACStrategy) {
      // Regla de simulación MAC (MACD):
      // Si ya está en rojo (Signal >= 3), salta de inmediato (distancia 0)
      if (cItem?.isStopRed) {
        stopPrice = currentPrice;
      } else {
        // En simulación de caída generalizada, el corte técnico de MAC salta al -15%
        stopPrice = currentPrice > 0 ? Number((currentPrice * 0.85).toFixed(4)) : 0;
      }
    } else if (isTrendPilotStrategy) {
      // Regla de simulación Trend Pilot:
      // Si ya está en rojo (Signal >= 3), salta de inmediato (distancia 0)
      if (cItem?.isStopRed) {
        stopPrice = currentPrice;
      } else {
        // En simulación de caída generalizada, el umbral estadístico de quiebre de tendencia salta al -20%
        stopPrice = currentPrice > 0 ? Number((currentPrice * 0.80).toFixed(4)) : 0;
      }
    } else if (typeof cItem?.stopValue === 'number' && !isNaN(cItem.stopValue) && cItem.stopValue > 0) {
      stopPrice = cItem.stopValue;
    } else if (typeof cItem?.stop === 'number' && !isNaN(cItem.stop) && cItem.stop > 0) {
      stopPrice = cItem.stop;
    }

    // Capital de la Posición (positionAmount):
    // Position.net_liq (si es > 0) o Position.quantity * Position.stock_last
    const posNetLiq = typeof pos.net_liq === 'number' && !isNaN(pos.net_liq) ? pos.net_liq : 0;
    let positionAmount = 0;
    if (posNetLiq > 0) {
      positionAmount = posNetLiq;
    } else {
      const qty = Math.abs(pos.quantity || 0);
      const px = currentPrice > 0 ? currentPrice : (pos.stock_last || 0);
      positionAmount = qty * px;
    }

    // Pérdida en Escenario de Stop (scenarioLoss) y Distancia al Stop (distancePct):
    let scenarioLoss = 0;
    let distancePct = 0;

    if (stopPrice > 0 && currentPrice > 0) {
      // Distancia al stop: (currentPrice - stopPrice) / currentPrice
      distancePct = (currentPrice - stopPrice) / currentPrice;

      if (currentPrice <= stopPrice) {
        // Stop ya cruzado o señal activa: el riesgo es inmediato
        scenarioLoss = positionAmount * Math.abs(distancePct);
      } else {
        scenarioLoss = positionAmount * (1 - (stopPrice / currentPrice));
      }
    } else {
      // Sin stop válido (Review)
      scenarioLoss = 0;
      distancePct = 1; // Sin stop definido, no salta automáticamente
    }

    const needsReview = cItem?.needsReview ?? (stopPrice === 0);
    const reviewReason = cItem?.reviewReason || (stopPrice === 0 ? 'Missing quote or stop formula in MK-TOS' : undefined);

    rawItems.push({
      id,
      trade_code,
      symbol,
      strategy,
      currentPrice,
      stopPrice,
      distancePct,
      positionAmount,
      scenarioLoss,
      needsReview,
      reviewReason
    });
  }

  // Agrupación y Ratios
  const strategyLossMap = new Map<string, number>();
  const strategyCapitalMap = new Map<string, number>();
  const strategyCountMap = new Map<string, number>();

  let totalPortfolioRisk = 0;
  let totalCapital = 0;

  for (const item of rawItems) {
    totalCapital += item.positionAmount;
    totalPortfolioRisk += item.scenarioLoss;

    const curLoss = strategyLossMap.get(item.strategy) || 0;
    strategyLossMap.set(item.strategy, curLoss + item.scenarioLoss);

    const curCap = strategyCapitalMap.get(item.strategy) || 0;
    strategyCapitalMap.set(item.strategy, curCap + item.positionAmount);

    const curCount = strategyCountMap.get(item.strategy) || 0;
    strategyCountMap.set(item.strategy, curCount + 1);
  }

  // Posiciones enriquecidas con % de Sistema y % de Cartera
  const positionsResult: PositionRiskItem[] = rawItems.map(item => {
    const stratTotalLoss = strategyLossMap.get(item.strategy) || 0;
    const pctOfStrategy = stratTotalLoss > 0 ? (item.scenarioLoss / stratTotalLoss) : 0;
    const pctOfPortfolio = totalPortfolioRisk > 0 ? (item.scenarioLoss / totalPortfolioRisk) : 0;

    return {
      id: item.id,
      trade_code: item.trade_code,
      symbol: item.symbol,
      strategy: item.strategy,
      currentPrice: Number(item.currentPrice.toFixed(2)),
      stopPrice: Number(item.stopPrice.toFixed(2)),
      distancePct: item.distancePct,
      positionAmount: Number(item.positionAmount.toFixed(2)),
      scenarioLoss: Number(item.scenarioLoss.toFixed(2)),
      pctOfStrategy,
      pctOfPortfolio,
      needsReview: item.needsReview,
      reviewReason: item.reviewReason
    };
  });

  // Ordenar por defecto de mayor a menor riesgo en dólares
  positionsResult.sort((a, b) => b.scenarioLoss - a.scenarioLoss);

  // Resumen por Estrategia
  const summaries: StrategyRiskSummary[] = Array.from(strategyCapitalMap.keys()).map(strat => {
    const totalPositionAmount = strategyCapitalMap.get(strat) || 0;
    const totalScenarioLoss = strategyLossMap.get(strat) || 0;
    const positionsCount = strategyCountMap.get(strat) || 0;
    const pctOfPortfolioRisk = totalPortfolioRisk > 0 ? (totalScenarioLoss / totalPortfolioRisk) : 0;

    return {
      strategy: strat,
      positionsCount,
      totalPositionAmount: Number(totalPositionAmount.toFixed(2)),
      totalScenarioLoss: Number(totalScenarioLoss.toFixed(2)),
      pctOfPortfolioRisk
    };
  });

  // Ordenar resúmenes por mayor riesgo en dólares
  summaries.sort((a, b) => b.totalScenarioLoss - a.totalScenarioLoss);

  // Curva de Caídas de Mercado (0% a 50%)
  const dropLevels = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const drops: MarketDropLevel[] = dropLevels.map(dropPct => {
    if (dropPct === 0) {
      // A 0% de caída, se incluye el 100% del capital inicial activo
      return {
        dropPct: 0,
        remainingCapital: Number(totalCapital.toFixed(2)),
        stoppedOutCapital: 0,
        stoppedPositionsCount: 0
      };
    }

    const dropDecimal = dropPct / 100;
    let stoppedOutCapital = 0;
    let stoppedPositionsCount = 0;

    for (const item of rawItems) {
      // Salta si tiene stop válido y la distancia <= dropDecimal
      if (item.stopPrice > 0 && item.distancePct <= dropDecimal) {
        stoppedOutCapital += item.positionAmount;
        stoppedPositionsCount += 1;
      }
    }

    const remainingCapital = Math.max(0, totalCapital - stoppedOutCapital);

    return {
      dropPct,
      remainingCapital: Number(remainingCapital.toFixed(2)),
      stoppedOutCapital: Number(stoppedOutCapital.toFixed(2)),
      stoppedPositionsCount
    };
  });

  const overallRiskPct = totalCapital > 0 ? (totalPortfolioRisk / totalCapital) : 0;

  return {
    summaries,
    positions: positionsResult,
    drops,
    totalCapital: Number(totalCapital.toFixed(2)),
    totalRisk: Number(totalPortfolioRisk.toFixed(2)),
    overallRiskPct
  };
}
