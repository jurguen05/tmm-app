// lib/archivePolicy.ts

/**
 * Política de archivado automático de archivos MK-TOS.
 *
 * Fundamento (ver STRATEGIES_STOPS.md):
 * - Tech Trader, Trend Pilot, MAC, New Yearly Highs, 100-day-High, BBO y Hedge
 *   usan solo la cotización más reciente (los indicadores ya vienen calculados por TOS).
 * - 20% Flipper y Weekend Trader persisten su pico en trades.max_stock_price.
 * - El filtro de mercado de Weekend Trader (SPY vs SMA 10W) persiste en spy_daily_closes.
 *
 * Por lo tanto solo hace falta mantener activa una ventana corta de fechas de cotización.
 * 10 fechas de mercado ≈ 2 semanas: garantiza al menos 2 cierres semanales (viernes, o
 * jueves por feriado) y margen para transacciones cargadas con 1-2 días de demora.
 */
export const MK_TOS_ACTIVE_QUOTE_DATES = 10;

export interface MkTosFileWithDate {
  id: string;
  quote_date: string | null; // ISO YYYY-MM-DD (todas las filas de un archivo comparten la fecha)
}

/**
 * Devuelve los IDs de archivos MK-TOS a archivar: los que no pertenecen a las
 * `keepDates` fechas de cotización más recientes.
 * Archivos sin fecha determinable nunca se archivan (criterio conservador).
 */
export const seleccionarArchivosMkTosParaArchivar = (
  files: MkTosFileWithDate[],
  keepDates: number = MK_TOS_ACTIVE_QUOTE_DATES
): string[] => {
  if (!files || files.length === 0 || keepDates <= 0) return [];

  const distinctDates = Array.from(
    new Set(files.map(f => f.quote_date).filter((d): d is string => Boolean(d)))
  ).sort((a, b) => b.localeCompare(a));

  if (distinctDates.length <= keepDates) return [];

  const oldestKeptDate = distinctDates[keepDates - 1];

  return files
    .filter(f => f.quote_date && f.quote_date < oldestKeptDate)
    .map(f => f.id);
};
