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

/**
 * Formatea un valor monetario estándar (ej: 1.234,56 o -1.234,56).
 */
export const formatearMoneda = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined || isNaN(valor)) return '0,00';
  
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

/** Alias en inglés para formatearMoneda */
export const formatMoney = formatearMoneda;

/**
 * Formatea un valor numérico entero redondeado con separadores de miles (ej: 17.380 o -1.235).
 */
export const formatIntegerMoney = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined || isNaN(valor)) return '0';
  const isNeg = valor < 0;
  const rounded = Math.round(Math.abs(valor));
  const formatted = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0
  }).format(rounded);
  return isNeg ? `-${formatted}` : formatted;
};

/**
 * Formatea porcentajes con 2 decimales (ej: 12,34%).
 */
export const formatPct = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined || isNaN(valor)) return '0,00%';
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
  return `${formatted}%`;
};

/**
 * Formateador de múltiplos R (ej: +0,35 R o -0,20 R).
 */
export const formatR = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined || isNaN(valor)) return '0,00 R';
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
  return valor > 0 ? `+${formatted} R` : `${formatted} R`;
};

/**
 * Formateador de ratios numéricos simples con 2 decimales (ej: 2,15).
 */
export const formatRatio = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined || isNaN(valor)) return '0,00';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

/**
 * Parsea un string con formato argentino (ej: "17.379,61" o "17.380") a float estándar.
 */
export const parseNumberEsAR = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '');
    }
  }
  const clean = str.replace(/[^0-9.-]+/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

/**
 * Parsea fechas provenientes de ThinkorSwim (archivos CSV, cabeceras o nombres de archivo)
 * y devuelve siempre el formato ISO de fecha pura "YYYY-MM-DD" sin pasar por objetos Date,
 * evitando discrepancias de huso horario (UTC vs local).
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

/**
 * Determina si una fecha en formato ISO "YYYY-MM-DD" corresponde a una sesión de cierre semanal:
 * - Viernes (5)
 * - Jueves (4) si el viernes siguiente no figura en el conjunto de fechas de cotizaciones disponibles (feriado bursátil)
 */
export const esCierreSemanal = (
  fechaISO: string | null | undefined,
  fechasDisponibles?: Set<string>
): boolean => {
  if (!fechaISO) return false;
  const match = fechaISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  const d = parseInt(match[3], 10);
  const dt = new Date(Date.UTC(y, m, d));
  const day = dt.getUTCDay();

  // 1. Viernes
  if (day === 5) return true;

  // 2. Jueves si el viernes no tuvo cotización registrada (feriado bursátil)
  if (day === 4 && fechasDisponibles && fechasDisponibles.size > 0) {
    const nextDay = new Date(Date.UTC(y, m, d + 1));
    const nextDayISO = nextDay.toISOString().substring(0, 10);
    return !fechasDisponibles.has(nextDayISO);
  }

  return false;
};

/**
 * Calcula la cantidad de días hábiles (lunes a viernes) transcurridos
 * entre una fecha de archivo (fechaISO) y la fecha de referencia (por defecto hoy).
 * Si fechaISO >= fechaReferencia, retorna 0.
 */
export const calcularDiasHabilesDiferencia = (
  fechaISO: string | null | undefined,
  fechaReferenciaISO?: string | null | undefined
): number => {
  if (!fechaISO) return 0;

  const match1 = fechaISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match1) return 0;

  const y1 = parseInt(match1[1], 10);
  const m1 = parseInt(match1[2], 10) - 1;
  const d1 = parseInt(match1[3], 10);
  const start = new Date(Date.UTC(y1, m1, d1));

  let refDate: Date;
  if (fechaReferenciaISO) {
    const match2 = fechaReferenciaISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match2) {
      refDate = new Date(Date.UTC(parseInt(match2[1], 10), parseInt(match2[2], 10) - 1, parseInt(match2[3], 10)));
    } else {
      refDate = new Date();
    }
  } else {
    const now = new Date();
    const localISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [ny, nm, nd] = localISO.split('-').map(Number);
    refDate = new Date(Date.UTC(ny, nm - 1, nd));
  }

  // Si la fecha del archivo es igual o posterior a la referencia
  if (start.getTime() >= refDate.getTime()) {
    return 0;
  }

  let businessDays = 0;
  const cur = new Date(start.getTime());

  // Iterar día por día desde el día siguiente al archivo hasta la fecha de referencia inclusive
  while (cur.getTime() < refDate.getTime()) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const dayOfWeek = cur.getUTCDay();
    // 0 = Domingo, 6 = Sábado
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }

  return businessDays;
};