// lib/hedgingCalculator.ts

import {
  Position,
  Transaction,
  MkTosQuote,
  Trade,
  Strategy,
  SpyDailyClose,
  SpitznagelBudget,
  HedgeContractItem,
  MarianShieldStep,
  HedgingDashboardData,
  RollAlertStatus
} from '../types';
import { clasificarTipoInstrumento } from './dashboardStatsCalculator';
import { calcularPortfolioRisk } from './portfolioRiskCalculator';

/**
 * Matriz oficial de expansión de volatilidad implícita (Δ IV) de The Marian Shield (v4.0)
 * extendida con dinámica de crisis sistémica y VIX extremo hasta el -50%.
 */
export const MARIAN_SHIELD_IV_EXPANSION_PTS: Record<number, number> = {
  0: 0.0,  // Base de mercado actual
  5: 8.4,
  10: 12.2,
  15: 15.4,
  20: 21.0, // Bear Market
  25: 26.6,
  30: 32.0, // Crisis severa
  35: 37.5,
  40: 42.0,
  45: 46.0,
  50: 50.0  // Colapso sistémico / VIX extremo
};

export const DEFAULT_BASELINE_IV = 22.0;

/**
 * Parsea los componentes de un contrato de opción a partir de su unique_key.
 * Formatos habituales:
 * - "QQQ-01/15/2027 380 P"
 * - "QQQ-15/01/2027 380.5 P"
 * - "QQQ 15 JAN 26 380 PUT"
 */
export function parseOptionUniqueKey(uniqueKey: string | null | undefined): {
  strike: number;
  expiration: string;
  type: 'C' | 'P' | null;
} {
  if (!uniqueKey) {
    return { strike: 0, expiration: '', type: null };
  }

  const clean = uniqueKey.trim();

  // 1. Formato estándar normalizado: TIK-MM/DD/YYYY STRIKE TYPE (ej: QQQ-01/15/2027 380 P)
  const normMatch = clean.match(/^([A-Z]+)-(\d{1,2})\/(\d{1,2})\/(\d{4})\s+([0-9.]+)\s+([CP])$/i);
  if (normMatch) {
    const expiration = `${normMatch[2].padStart(2, '0')}/${normMatch[3].padStart(2, '0')}/${normMatch[4]}`;
    const strike = parseFloat(normMatch[5]);
    const type = normMatch[6].toUpperCase() as 'C' | 'P';
    return { strike: isNaN(strike) ? 0 : strike, expiration, type };
  }

  // 2. Formato TOS crudo: "QQQ 15 JAN 26 380 PUT"
  const monthMap: Record<string, string> = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
    'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };
  const tosMatch = clean.match(/^([A-Z]+)\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{2,4})\s+([0-9.]+)\s+(CALL|PUT)$/i);
  if (tosMatch) {
    const day = tosMatch[2].padStart(2, '0');
    const mm = monthMap[tosMatch[3].toUpperCase()] || '01';
    let yr = tosMatch[4];
    if (yr.length === 2) yr = `20${yr}`;
    const strike = parseFloat(tosMatch[5]);
    const type = tosMatch[6].toUpperCase() === 'CALL' ? 'C' : 'P';
    return { strike: isNaN(strike) ? 0 : strike, expiration: `${mm}/${day}/${yr}`, type };
  }

  // Fallback genérico: extraer strike y tipo del final
  const parts = clean.split(/\s+/);
  let strike = 0;
  let type: 'C' | 'P' | null = null;
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toUpperCase();
    if (last === 'P' || last === 'PUT') type = 'P';
    else if (last === 'C' || last === 'CALL') type = 'C';

    const strikePart = parseFloat(parts[parts.length - 2]);
    if (!isNaN(strikePart)) strike = strikePart;
  }

  return { strike, expiration: '', type };
}

/**
 * Determina si una posición es un contrato de cobertura defensiva (Hedge Put).
 */
export function isHedgePutPosition(pos: Position): boolean {
  const sym = (pos.symbol || '').toUpperCase().trim();
  const tipo = clasificarTipoInstrumento(pos.unique_key);
  if (tipo !== 'PUT') return false;

  // Si el ticker es QQQ o SPY
  if (sym === 'QQQ' || sym === 'SPY') return true;

  return false;
}

/**
 * Extrae el precio spot actual de QQQ a partir de:
 * 1. La fila de la acción QQQ en positions (stock_last o stock_mark)
 * 2. Cotizaciones de MkTosQuote si estuviesen disponibles
 * 3. Fallback en contratos de opciones QQQ (donde stock_last indica el precio del subyacente)
 */
export function extractQqqPrice(positions: Position[], mkTosQuotes?: MkTosQuote[]): number {
  // 1. Buscar cotización directa en mkTosQuotes
  if (mkTosQuotes && mkTosQuotes.length > 0) {
    const qQuote = mkTosQuotes.find(q => q.symbol && q.symbol.toUpperCase() === 'QQQ');
    if (qQuote && qQuote.last_price > 0) return qQuote.last_price;
  }

  // 2. Buscar en positions fila de acciones QQQ
  const qqqStockPos = positions.find(p => {
    const sym = (p.symbol || '').toUpperCase().trim();
    const tipo = clasificarTipoInstrumento(p.unique_key);
    return sym === 'QQQ' && tipo === 'Stock';
  });
  if (qqqStockPos) {
    if (qqqStockPos.stock_last && qqqStockPos.stock_last > 0) return qqqStockPos.stock_last;
    if (qqqStockPos.stock_mark && qqqStockPos.stock_mark > 0) return qqqStockPos.stock_mark;
  }

  // 3. Buscar en positions cualquier fila de QQQ (opciones) que tenga stock_last o stock_mark
  const anyQqqPos = positions.find(p => (p.symbol || '').toUpperCase().trim() === 'QQQ' && ((p.stock_last && p.stock_last > 0) || (p.stock_mark && p.stock_mark > 0)));
  if (anyQqqPos) {
    return anyQqqPos.stock_last > 0 ? anyQqqPos.stock_last : anyQqqPos.stock_mark;
  }

  return 0;
}

/**
 * 1. Calcula el presupuesto mecánico Pure Spitznagel Ladder y apalancamiento
 */
export function calcularSpitznagelBudget(
  positions: Position[],
  cashBalance: number = 0,
  qqqPriceManual?: number
): SpitznagelBudget {
  let positionsValue = 0;
  let totalEquity = typeof cashBalance === 'number' && !isNaN(cashBalance) ? cashBalance : 0;

  for (const pos of positions) {
    const netLiq = typeof pos.net_liq === 'number' && !isNaN(pos.net_liq) ? pos.net_liq : 0;
    totalEquity += netLiq;

    // Cálculo del capital en riesgo de mercado (Exposición nocional y delta-ajustada):
    // 1. Acciones (Stock): Precio x Cantidad
    // 2. Opciones CALL: Precio x Cantidad x 100 x Option Delta
    const tipo = clasificarTipoInstrumento(pos.unique_key);
    const qty = Math.abs(pos.quantity || 0);
    const px = (pos.stock_last && pos.stock_last > 0)
      ? pos.stock_last
      : ((pos.stock_mark && pos.stock_mark > 0) ? pos.stock_mark : (pos.trade_price || 0));

    if (tipo === 'Stock') {
      const stockExposure = (px > 0 && qty > 0) ? (px * qty) : netLiq;
      positionsValue += stockExposure;
    } else if (tipo === 'CALL') {
      // Delta de la opción (de option_delta o delta_position / (qty * 100))
      let callDelta = typeof pos.option_delta === 'number' && !isNaN(pos.option_delta) ? Math.abs(pos.option_delta) : 0;
      if (callDelta === 0 && pos.delta_position && qty > 0) {
        callDelta = Math.abs(pos.delta_position) / (qty * 100);
      }
      // Si delta no está disponible, fallback al net_liq
      const callExposure = (px > 0 && qty > 0 && callDelta > 0)
        ? (px * qty * 100 * callDelta)
        : netLiq;
      positionsValue += callExposure;
    }
  }

  // Apalancamiento actual: positionsValue / totalEquity
  const currentLeverage = totalEquity > 0 ? positionsValue / totalEquity : 0;
  const baseTargetLeverage = 1.0;
  const leverageIncrease = Math.max(0, currentLeverage - baseTargetLeverage);

  // Layer 1: Base Fija 3% anual
  const annualBaseBudget = totalEquity * 0.03;
  const monthlyBaseBudget = annualBaseBudget / 12;

  // Layer 2: Ajuste por apalancamiento (> 1.0x)
  // Por cada 0.25x de exceso -> 0.4% anual (0.004)
  const isLayer2Active = currentLeverage > 1.0;
  const excessUnits = isLayer2Active ? leverageIncrease / 0.25 : 0;
  const annualExposureBudget = isLayer2Active ? totalEquity * (excessUnits * 0.004) : 0;
  const monthlyExposureBudget = annualExposureBudget / 12;

  // Presupuesto Total y División por Tranche / Escalera (30% / 40% / 30%)
  const totalAnnualBudget = annualBaseBudget + annualExposureBudget;
  const totalMonthlyBudget = totalAnnualBudget / 12;
  const monthlyTrancheBudget = totalMonthlyBudget / 3;

  // Asignación 30 / 40 / 30 del modelo de rotación Spitznagel:
  const trancheABudgetMonthly = totalMonthlyBudget * 0.30;
  const trancheBBudgetMonthly = totalMonthlyBudget * 0.40;
  const trancheCBudgetMonthly = totalMonthlyBudget * 0.30;

  const trancheABudgetAnnual = totalAnnualBudget * 0.30;
  const trancheBBudgetAnnual = totalAnnualBudget * 0.40;
  const trancheCBudgetAnnual = totalAnnualBudget * 0.30;

  const totalHedgePct = totalEquity > 0 ? totalAnnualBudget / totalEquity : 0;

  // QQQ Spot y Target Strike (30% OTM = 70% del spot)
  const resolvedQqqPrice = typeof qqqPriceManual === 'number' && qqqPriceManual > 0
    ? qqqPriceManual
    : extractQqqPrice(positions);
  const targetStrike = resolvedQqqPrice > 0 ? resolvedQqqPrice * 0.70 : 0;

  return {
    totalEquity: Number(totalEquity.toFixed(2)),
    positionsValue: Number(positionsValue.toFixed(2)),
    currentLeverage: Number(currentLeverage.toFixed(4)),
    baseTargetLeverage,
    leverageIncrease: Number(leverageIncrease.toFixed(4)),
    isLayer2Active,
    excessUnits: Number(excessUnits.toFixed(4)),
    qqqPrice: Number(resolvedQqqPrice.toFixed(2)),
    targetStrike: Number(targetStrike.toFixed(2)),
    annualBaseBudget: Number(annualBaseBudget.toFixed(2)),
    monthlyBaseBudget: Number(monthlyBaseBudget.toFixed(2)),
    annualExposureBudget: Number(annualExposureBudget.toFixed(2)),
    monthlyExposureBudget: Number(monthlyExposureBudget.toFixed(2)),
    totalAnnualBudget: Number(totalAnnualBudget.toFixed(2)),
    totalMonthlyBudget: Number(totalMonthlyBudget.toFixed(2)),
    monthlyTrancheBudget: Number(monthlyTrancheBudget.toFixed(2)),
    trancheABudgetMonthly: Number(trancheABudgetMonthly.toFixed(2)),
    trancheBBudgetMonthly: Number(trancheBBudgetMonthly.toFixed(2)),
    trancheCBudgetMonthly: Number(trancheCBudgetMonthly.toFixed(2)),
    trancheABudgetAnnual: Number(trancheABudgetAnnual.toFixed(2)),
    trancheBBudgetAnnual: Number(trancheBBudgetAnnual.toFixed(2)),
    trancheCBudgetAnnual: Number(trancheCBudgetAnnual.toFixed(2)),
    totalHedgePct: Number(totalHedgePct.toFixed(4))
  };
}

/**
 * 2. Auditoría y extracción de las Puts de cobertura activas (QQQ/SPY) con alertas de Roll
 */
export function auditarHedgeContracts(
  positions: Position[],
  targetStrike: number
): HedgeContractItem[] {
  const hedgeItems: HedgeContractItem[] = [];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (!isHedgePutPosition(pos)) continue;

    const { strike, expiration } = parseOptionUniqueKey(pos.unique_key);
    const quantity = pos.quantity || 0;
    const net_liq = typeof pos.net_liq === 'number' && !isNaN(pos.net_liq) ? pos.net_liq : 0;
    const days = typeof pos.days === 'number' && !isNaN(pos.days) ? pos.days : 0;
    const option_delta = typeof pos.option_delta === 'number' && !isNaN(pos.option_delta) ? pos.option_delta : 0;
    const option_theta = typeof pos.option_theta === 'number' && !isNaN(pos.option_theta) ? pos.option_theta : 0;

    const currentPrice = (pos.stock_last && pos.stock_last > 0)
      ? pos.stock_last
      : ((pos.stock_mark && pos.stock_mark > 0) ? pos.stock_mark : (quantity !== 0 ? Math.abs(net_liq / (quantity * 100)) : 0));

    // Reglas de alerta de Roll:
    // Alerta Roll Up: Si Strike < targetStrike * 0.95
    const rollUpNeeded = targetStrike > 0 && strike > 0 && strike < (targetStrike * 0.95);
    // Alerta Roll Forward: Si days <= 30
    const rollForwardNeeded = days <= 30 && days > 0;

    let status: RollAlertStatus = 'OK';
    if (rollUpNeeded && rollForwardNeeded) {
      status = 'ROLL_BOTH';
    } else if (rollUpNeeded) {
      status = 'ROLL_UP';
    } else if (rollForwardNeeded) {
      status = 'ROLL_FORWARD';
    }

    hedgeItems.push({
      id: pos.id || `${pos.unique_key || pos.symbol}-${i}`,
      symbol: pos.symbol || 'QQQ',
      unique_key: pos.unique_key,
      strike: Number(strike.toFixed(2)),
      expiration: expiration || (pos.statement_date || ''),
      days,
      quantity,
      net_liq: Number(net_liq.toFixed(2)),
      currentPrice: Number(currentPrice.toFixed(2)),
      option_delta: Number(option_delta.toFixed(4)),
      option_theta: Number(option_theta.toFixed(4)),
      rollUpNeeded,
      rollForwardNeeded,
      status
    });
  }

  return hedgeItems;
}

/**
 * 3. Simulación The Marian Shield (v4.0) hasta el -50% de caída de mercado
 */
export function simularMarianShield(
  positions: Position[],
  transactions: Transaction[],
  budget: SpitznagelBudget,
  hedgeContracts: HedgeContractItem[],
  mkTosQuotes?: MkTosQuote[],
  trades?: Trade[],
  strategies?: Strategy[],
  spyCloses?: SpyDailyClose[],
  baselineIV: number = DEFAULT_BASELINE_IV
): MarianShieldStep[] {
  // 1. Obtener curva de absorción de stops de la cartera a través de portfolioRiskCalculator
  const portfolioRisk = calcularPortfolioRisk(
    positions,
    transactions,
    mkTosQuotes,
    trades,
    strategies,
    spyCloses
  );

  // Mapear drops por porcentaje
  const dropMap = new Map<number, { remainingCapital: number; stoppedOutCapital: number }>();
  portfolioRisk.drops.forEach(d => {
    dropMap.set(d.dropPct, {
      remainingCapital: d.remainingCapital,
      stoppedOutCapital: d.stoppedOutCapital
    });
  });

  const dropPercentages = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const qqqCurrentPrice = budget.qqqPrice > 0 ? budget.qqqPrice : 500;
  const totalEquity = budget.totalEquity > 0 ? budget.totalEquity : 1;
  const initialStockCapital = portfolioRisk.totalCapital;

  // Valor actual de mercado de las Puts (Base de partida del hedge)
  const currentHedgeMarketValue = hedgeContracts.reduce((acc, h) => acc + Math.max(0, h.net_liq), 0);

  const steps: MarianShieldStep[] = dropPercentages.map(dropPct => {
    const dropDecimal = dropPct / 100;
    const qqqDropPrice = Number((qqqCurrentPrice * (1 - dropDecimal)).toFixed(2));

    // Expansión de volatilidad implícita
    const ivExpansionPts = MARIAN_SHIELD_IV_EXPANSION_PTS[dropPct] || (dropPct * 1.0);
    const projectedIV = Number((baselineIV + ivExpansionPts).toFixed(2));

    // Exposición de acciones remanente y pérdida por stops
    const dropData = dropMap.get(dropPct) || {
      remainingCapital: Math.max(0, initialStockCapital * (1 - dropDecimal)),
      stoppedOutCapital: initialStockCapital * dropDecimal
    };
    const remainingStockExposure = dropData.remainingCapital;
    const stoppedOutStockCapital = dropData.stoppedOutCapital;

    // Pérdida acumulada en acciones al absorber los stops
    // En caídas del mercado, las posiciones absorben pérdidas hasta su stop o sufren la caída si no tienen stop
    let stockLossAmount = 0;
    for (const posRisk of portfolioRisk.positions) {
      if (posRisk.stopPrice > 0 && posRisk.distancePct <= dropDecimal) {
        stockLossAmount += posRisk.scenarioLoss;
      } else {
        // Posiciones que aún no tocan stop sufren la caída de mercado actual
        stockLossAmount += posRisk.positionAmount * dropDecimal;
      }
    }
    stockLossAmount = Math.min(initialStockCapital, Math.max(0, stockLossAmount));
    const stockDrawdownPct = totalEquity > 0 ? stockLossAmount / totalEquity : 0;

    // Valorización analítica de las Puts a este nivel de caída
    let projectedTotalPutsValue = 0;
    let totalIntrinsic = 0;
    let totalExtrinsic = 0;

    for (const contract of hedgeContracts) {
      const contractsCount = Math.abs(contract.quantity);
      if (contractsCount === 0) continue;

      // Valor Intrínseco por contrato: max(0, Strike - QqqDrop) * 100
      const intrinsicPerShare = Math.max(0, contract.strike - qqqDropPrice);
      const intrinsicContract = intrinsicPerShare * 100;
      const contractIntrinsicTotal = intrinsicContract * contractsCount;
      totalIntrinsic += contractIntrinsicTotal;

      // Valor Extrínseco residual impulsado por la expansión de IV y días a vencimiento
      // Modelo de aproximación asimétrica de convexidad Marian Shield:
      // extrinsic = contracts * 100 * (projectedIV / 100) * sqrt(days / 365) * 0.4 * qqqDropPrice * moneyness_factor
      const days = Math.max(1, contract.days);
      const tYears = days / 365;
      const ivDec = projectedIV / 100;

      // Factor de at-the-money / cercanía: el valor extrínseco es máximo cerca del strike
      const moneyness = contract.strike > 0 ? qqqDropPrice / contract.strike : 1;
      const moneynessFactor = Math.exp(-0.5 * Math.pow(Math.log(moneyness) / 0.3, 2));

      // Prima extrínseca por acción aproximada
      const extrinsicPerShare = 0.4 * qqqDropPrice * ivDec * Math.sqrt(tYears) * Math.max(0.15, moneynessFactor);
      const contractExtrinsicTotal = extrinsicPerShare * 100 * contractsCount;
      totalExtrinsic += contractExtrinsicTotal;

      projectedTotalPutsValue += (contractIntrinsicTotal + contractExtrinsicTotal);
    }

    // Ganancia Neta del Hedge ($) = Valor Proyectado de las Puts - Valor Actual de Mercado de las Puts
    const hedgeGainAmount = Math.max(0, projectedTotalPutsValue - currentHedgeMarketValue);

    // Pérdida Neta Amortiguada ($) = Pérdida de Acciones - Ganancia del Hedge
    const netLossAmount = Math.max(0, stockLossAmount - hedgeGainAmount);

    // Drawdown Amortiguado con Marian Shield (%) = Pérdida Neta / totalEquity
    const bufferedDrawdownPct = totalEquity > 0 ? netLossAmount / totalEquity : 0;

    const totalContracts = hedgeContracts.reduce((acc, h) => acc + Math.abs(h.quantity), 0);
    const avgIntrinsicPerContract = totalContracts > 0 ? totalIntrinsic / totalContracts : 0;
    const avgExtrinsicPerContract = totalContracts > 0 ? totalExtrinsic / totalContracts : 0;

    return {
      dropPct,
      dropDecimal,
      qqqDropPrice,
      ivExpansionPts,
      projectedIV,
      remainingStockExposure: Number(remainingStockExposure.toFixed(2)),
      stoppedOutStockCapital: Number(stoppedOutStockCapital.toFixed(2)),
      stockLossAmount: Number(stockLossAmount.toFixed(2)),
      stockDrawdownPct: Number(stockDrawdownPct.toFixed(4)),
      hedgeGainAmount: Number(hedgeGainAmount.toFixed(2)),
      netLossAmount: Number(netLossAmount.toFixed(2)),
      bufferedDrawdownPct: Number(bufferedDrawdownPct.toFixed(4)),
      intrinsicValuePerContract: Number(avgIntrinsicPerContract.toFixed(2)),
      extrinsicValuePerContract: Number(avgExtrinsicPerContract.toFixed(2)),
      totalHedgeValue: Number(projectedTotalPutsValue.toFixed(2))
    };
  });

  return steps;
}

/**
 * Función principal unificada que genera el conjunto de datos completo para el módulo Hedging & Marian Shield
 */
export function calcularHedgingModule(
  positions: Position[],
  transactions: Transaction[],
  cashBalance: number = 0,
  mkTosQuotes?: MkTosQuote[],
  trades?: Trade[],
  strategies?: Strategy[],
  spyCloses?: SpyDailyClose[],
  baselineIV: number = DEFAULT_BASELINE_IV,
  qqqPriceManual?: number
): HedgingDashboardData {
  // 1. Presupuesto Spitznagel y apalancamiento
  const budget = calcularSpitznagelBudget(positions, cashBalance, qqqPriceManual);

  // 2. Auditoría de Puts activas
  const hedgeContracts = auditarHedgeContracts(positions, budget.targetStrike);
  const totalHedgeValue = hedgeContracts.reduce((acc, h) => acc + Math.max(0, h.net_liq), 0);

  // 3. Simulación The Marian Shield (v4.0) hasta el -50%
  const marianShieldSteps = simularMarianShield(
    positions,
    transactions,
    budget,
    hedgeContracts,
    mkTosQuotes,
    trades,
    strategies,
    spyCloses,
    baselineIV
  );

  return {
    budget,
    hedgeContracts,
    totalHedgeValue: Number(totalHedgeValue.toFixed(2)),
    baselineIV,
    marianShieldSteps
  };
}
