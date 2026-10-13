// lib/formatters.ts

/**
 * Normaliza valores numéricos que puedan venir como strings sucios, con formato de moneda,
 * comas de miles, signos de porcentaje o cadenas de carga ("loading", "N/A").
 */
export const normalizeNumber = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  const str = value.toString().trim();
  if (!str || str.toLowerCase().includes('loading') || str.toLowerCase() === 'n/a') return 0;
  
  const cleanStr = str.replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

export const formatearMoneda = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined) return '0,00';
  
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

/**
 * Parsea fechas provenientes de ThinkorSwim (archivos CSV, cabeceras o nombres de archivo)
 * y devuelve siempre el formato ISO de fecha pura "YYYY-MM-DD" sin pasar por objetos Date,
 * evitando discrepancias de huso horario (UTC vs local).
 * 
 * Ejemplos soportados:
 * - "10/09/2026" -> "2026-10-09"
 * - "10/9/26 18:50:27" -> "2026-10-09"
 * - "Quote on 8/28/26 18:03:35" -> "2026-08-28"
 * - "2026-10-09-PositionStatement.csv" -> "2026-10-09"
 */
export const parsearFechaTOS = (rawDate: string | null | undefined): string | null => {
  if (!rawDate) return null;

  // 1. Si ya contiene formato ISO YYYY-MM-DD (ej: "2026-10-09" o nombre de archivo)
  const isoMatch = rawDate.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return isoMatch[0];
  }

  // 2. Formato ThinkorSwim: MM/DD/YYYY o M/D/YY (con o sin hora)
  const matches = [...rawDate.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const mm = lastMatch[1].padStart(2, '0');
    const dd = lastMatch[2].padStart(2, '0');
    let yyyy = lastMatch[3];
    if (yyyy.length === 2) {
      yyyy = `20${yyyy}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
};

/**
 * Formatea un string de fecha (ej: "2026-10-09") a "DD/MM/YYYY" para la vista de usuario.
 * No utiliza 'new Date()' para prevenir que la zona horaria del navegador reste horas
 * y cambie el día visible.
 */
export const formatearFecha = (fechaTexto: string | null | undefined): string => {
  if (!fechaTexto) return '-';
  const soloFecha = fechaTexto.split('T')[0].split(' ')[0].trim();
  const parts = soloFecha.split('-');
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  }
  return soloFecha;
};

/**
 * Alias de compatibilidad para formatearFecha
 */
export const fechaSegura = (fechaTexto: string | null | undefined): string => {
  return formatearFecha(fechaTexto);
};

/**
 * Normaliza la clave única (unique_key) para opciones de modo que coincidan
 * independientemente de si la fecha de expiración se almacenó como MM/DD/YYYY o DD/MM/YYYY.
 */
export const normalizeUniqueKey = (key: string | null | undefined): string => {
  if (!key) return '';
  const clean = key.trim();
  const match = clean.match(/^([A-Z]+)-(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/);
  if (match) {
    const ticker = match[1];
    const p1 = parseInt(match[2], 10);
    const p2 = parseInt(match[3], 10);
    const yyyy = match[4];
    const rest = match[5];
    let mm = match[2].padStart(2, '0');
    let dd = match[3].padStart(2, '0');
    if (p1 > 12 && p2 <= 12) {
      // p1 es día (ej: 15/01/2027) -> normalizar a MM/DD/YYYY
      dd = match[2].padStart(2, '0');
      mm = match[3].padStart(2, '0');
    }
    return `${ticker}-${mm}/${dd}/${yyyy} ${rest}`.toUpperCase();
  }
  return clean.toUpperCase();
};

/**
 * Determina si una fecha en formato ISO "YYYY-MM-DD" corresponde a un día viernes.
 * Utiliza fecha UTC para evitar desfasajes horarios de zona.
 */
export const esViernes = (fechaISO: string | null | undefined): boolean => {
  if (!fechaISO) return false;
  const match = fechaISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  const d = parseInt(match[3], 10);
  const dt = new Date(Date.UTC(y, m, d));
  return dt.getUTCDay() === 5; // 5 = Viernes (0 = Domingo)
};