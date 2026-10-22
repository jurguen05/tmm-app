// lib/contractCalculator.ts

import {
  Contract,
  ContractMovement,
  ContractRate,
  ContractMonthlyLedgerRow,
  ContractFinancialSummary,
  LockedDepositItem
} from '../types/index';

/**
 * Calcula la diferencia en días entre dos fechas ISO (YYYY-MM-DD)
 */
export function getDaysDifference(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Agrega N meses a una fecha ISO manteniendo el día de corte deseado
 */
export function addMonthsToDate(dateStr: string, monthsToAdd: number, targetDay?: number): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1 + monthsToAdd; // 0-indexed month
  
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;

  const day = targetDay !== undefined ? targetDay : parseInt(dayStr, 10);
  // Obtener último día del mes destino para evitar desbordes (ej. 31 de feb -> 28 feb)
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayOfMonth);

  const formattedMonth = String(month + 1).padStart(2, '0');
  const formattedDay = String(safeDay).padStart(2, '0');
  return `${year}-${formattedMonth}-${formattedDay}`;
}

/**
 * Obtiene la tasa aplicable para un contrato en una fecha dada
 */
export function getRateForDate(
  rates: ContractRate[] | undefined,
  dateStr: string
): { investorRate: number; originatorRate: number } {
  if (!rates || rates.length === 0) {
    return { investorRate: 0, originatorRate: 0 };
  }

  // Filtrar tasas cuya vigencia sea <= a la fecha consultada y ordenar de más reciente a más antigua
  const applicableRates = rates
    .filter(r => r.effective_date <= dateStr)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  if (applicableRates.length > 0) {
    return {
      investorRate: applicableRates[0].investor_annual_rate,
      originatorRate: applicableRates[0].originator_annual_rate || 0
    };
  }

  // Si ninguna es <=, tomar la primera existente por fecha
  const sortedAsc = [...rates].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  return {
    investorRate: sortedAsc[0].investor_annual_rate,
    originatorRate: sortedAsc[0].originator_annual_rate || 0
  };
}

/**
 * Genera la tabla mensual de evolución del contrato (idéntica al Excel)
 * Incluye interés compuesto mensual, prorrateo diario para depósitos intermedios
 * y comisiones del originador.
 */
export function calculateMonthlyLedger(
  contract: Contract,
  targetDateStr?: string
): ContractMonthlyLedgerRow[] {
  const ledger: ContractMonthlyLedgerRow[] = [];
  const rates = contract.rates || [];
  const movements = contract.movements || [];

  const startDate = contract.start_date;
  const cutoffDay = contract.cutoff_day;

  // Fecha fin de proyección: targetDate o fecha actual + 6 meses si no hay target
  const nowStr = targetDateStr || new Date().toISOString().split('T')[0];
  const maxProjectedDate = addMonthsToDate(nowStr, 2, cutoffDay);

  // Determinar la primera fecha de corte posterior al inicio
  let currentCutoff = addMonthsToDate(startDate, 0, cutoffDay);
  if (currentCutoff <= startDate) {
    currentCutoff = addMonthsToDate(startDate, 1, cutoffDay);
  }

  // Fila 0: Estado inicial al día de alta
  const initialRate = getRateForDate(rates, startDate);
  let currentCapital = contract.initial_amount;

  ledger.push({
    period_index: 0,
    cutoff_date: startDate,
    capital_prev: 0,
    investor_rate: initialRate.investorRate,
    originator_rate: initialRate.originatorRate,
    delta_interest: 0,
    delta_originator_commission: 0,
    delta_capital_deposit: contract.initial_amount,
    capital_withdrawal: 0,
    interest_withdrawal: 0,
    capital_end: currentCapital
  });

  let periodIndex = 1;
  let previousCutoff = startDate;

  while (currentCutoff <= maxProjectedDate && (currentCapital > 0 || periodIndex <= 1)) {
    const rateInfo = getRateForDate(rates, currentCutoff);
    const capitalPrev = currentCapital;

    // 1. Interés regular mensual sobre el capital previo disponible todo el mes
    const monthlyRate = rateInfo.investorRate / 12;
    const monthlyOriginatorRate = rateInfo.originatorRate / 12;
    let periodInterest = capitalPrev * monthlyRate;
    let periodOriginatorCommission = capitalPrev * monthlyOriginatorRate;

    // 2. Movimientos ocurridos en este intervalo (previousCutoff < movement_date <= currentCutoff)
    // Nota: Excluir el depósito inicial si coincidió con startDate
    const periodMovements = movements.filter(m => {
      if (m.movement_date === startDate && m.amount === contract.initial_amount && m.movement_type === 'CAPITAL_DEPOSIT') {
        return false;
      }
      return m.movement_date > previousCutoff && m.movement_date <= currentCutoff;
    });

    let deltaDeposits = 0;
    let capitalWithdrawals = 0;
    let interestWithdrawals = 0;

    for (const mov of periodMovements) {
      if (mov.movement_type === 'CAPITAL_DEPOSIT') {
        deltaDeposits += mov.amount;
        // Prorrateo diario por los días transcurridos desde el depósito hasta el corte
        const daysActive = getDaysDifference(mov.movement_date, currentCutoff);
        const dailyRate = rateInfo.investorRate / 365;
        const dailyOriginatorRate = rateInfo.originatorRate / 365;
        periodInterest += mov.amount * dailyRate * daysActive;
        periodOriginatorCommission += mov.amount * dailyOriginatorRate * daysActive;
      } else if (mov.movement_type === 'CAPITAL_WITHDRAWAL') {
        capitalWithdrawals += mov.amount;
      } else if (mov.movement_type === 'INTEREST_WITHDRAWAL') {
        interestWithdrawals += mov.amount;
      }
    }

    // Capital final al cierre del período (Interés compuesto: los intereses devengados se capitalizan, salvo los retirados)
    const capitalEnd = Math.max(
      0,
      capitalPrev + periodInterest + deltaDeposits - capitalWithdrawals - interestWithdrawals
    );

    ledger.push({
      period_index: periodIndex,
      cutoff_date: currentCutoff,
      capital_prev: capitalPrev,
      investor_rate: rateInfo.investorRate,
      originator_rate: rateInfo.originatorRate,
      delta_interest: periodInterest,
      delta_originator_commission: periodOriginatorCommission,
      delta_capital_deposit: deltaDeposits,
      capital_withdrawal: capitalWithdrawals,
      interest_withdrawal: interestWithdrawals,
      capital_end: capitalEnd
    });

    currentCapital = capitalEnd;
    previousCutoff = currentCutoff;
    currentCutoff = addMonthsToDate(currentCutoff, 1, cutoffDay);
    periodIndex++;

    // Salir si el contrato ya está en 0 y pasaron al menos 2 períodos
    if (currentCapital <= 0 && periodIndex > 2) {
      break;
    }
  }

  return ledger;
}

/**
 * Calcula el resumen financiero integral del contrato:
 * - Capital total acumulado
 * - Capital retirable (> 6 meses)
 * - Capital bloqueado (< 6 meses) con detalle de días restantes
 * - Intereses devengados vs retirados
 * - Comisiones devengadas del originador
 */
export function calculateContractSummary(
  contract: Contract,
  ledger?: ContractMonthlyLedgerRow[],
  asOfDateStr?: string
): ContractFinancialSummary {
  const asOf = asOfDateStr || new Date().toISOString().split('T')[0];
  const monthlyLedger = ledger || calculateMonthlyLedger(contract, asOf);
  const movements = contract.movements || [];

  // Obtener último estado hasta la fecha de consulta
  const pastRows = monthlyLedger.filter(r => r.cutoff_date <= asOf);
  const latestRow = pastRows.length > 0 ? pastRows[pastRows.length - 1] : monthlyLedger[0];
  const totalCapital = latestRow ? latestRow.capital_end : contract.initial_amount;

  // Intereses acumulados y retirados
  const accumulatedInterest = pastRows.reduce((sum, r) => sum + r.delta_interest, 0);
  const withdrawnInterest = pastRows.reduce((sum, r) => sum + r.interest_withdrawal, 0);
  const availableInterest = Math.max(0, accumulatedInterest - withdrawnInterest);

  // Comisiones del originador
  const originatorAccumulatedCommissions = pastRows.reduce((sum, r) => sum + r.delta_originator_commission, 0);

  // Análisis de Lockup de 6 meses por depósito
  // Incluir el aporte inicial
  const allDeposits: { amount: number; depositDate: string; lockupUntil: string }[] = [
    {
      amount: contract.initial_amount,
      depositDate: contract.start_date,
      lockupUntil: addMonthsToDate(contract.start_date, 6)
    }
  ];

  movements.forEach(m => {
    if (m.movement_type === 'CAPITAL_DEPOSIT') {
      const lockupUntil = m.lockup_until || addMonthsToDate(m.movement_date, 6);
      allDeposits.push({
        amount: m.amount,
        depositDate: m.movement_date,
        lockupUntil
      });
    }
  });

  const lockedDeposits: LockedDepositItem[] = [];
  let lockedCapital = 0;
  let withdrawableDepositsTotal = 0;

  for (const dep of allDeposits) {
    if (dep.lockupUntil > asOf) {
      const daysRemaining = getDaysDifference(asOf, dep.lockupUntil);
      lockedCapital += dep.amount;
      lockedDeposits.push({
        amount: dep.amount,
        deposit_date: dep.depositDate,
        lockup_until: dep.lockupUntil,
        days_remaining: daysRemaining
      });
    } else {
      withdrawableDepositsTotal += dep.amount;
    }
  }

  // Retiros de capital totales realizados hasta la fecha
  const totalCapitalWithdrawals = movements
    .filter(m => m.movement_type === 'CAPITAL_WITHDRAWAL' && m.movement_date <= asOf)
    .reduce((sum, m) => sum + m.amount, 0);

  // Capital elegible disponible para retiro (> 6 meses)
  const withdrawableCapital = Math.max(0, Math.min(totalCapital, withdrawableDepositsTotal - totalCapitalWithdrawals));

  // Cálculo de próxima fecha de liquidación/cobro según payout_frequency
  const frequency = contract.payout_frequency || 'ON_DEMAND';
  let nextPayoutDate: string | null = null;

  if (frequency !== 'ON_DEMAND') {
    const stepMonths = frequency === 'MONTHLY' ? 1 : frequency === 'BIMONTHLY' ? 2 : frequency === 'SEMIANNUAL' ? 6 : 12;
    let candidate = addMonthsToDate(contract.start_date, stepMonths, contract.cutoff_day);
    while (candidate <= asOf) {
      candidate = addMonthsToDate(candidate, stepMonths, contract.cutoff_day);
    }
    nextPayoutDate = candidate;
  }

  const isClosed = totalCapital <= 0 || contract.status === 'Closed';

  return {
    total_capital: totalCapital,
    withdrawable_capital: withdrawableCapital,
    locked_capital: Math.min(lockedCapital, totalCapital),
    accumulated_interest: accumulatedInterest,
    withdrawn_interest: withdrawnInterest,
    available_interest: availableInterest,
    originator_accumulated_commissions: originatorAccumulatedCommissions,
    originator_pending_commissions: originatorAccumulatedCommissions,
    payout_frequency: frequency,
    next_payout_date: nextPayoutDate,
    is_closed: isClosed,
    locked_deposits: lockedDeposits
  };
}
