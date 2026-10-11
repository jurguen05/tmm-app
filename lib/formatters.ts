// lib/formatters.ts

export const formatearMoneda = (valor: number | null | undefined) => {
  if (valor === null || valor === undefined) return '0,00';
  
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

export const fechaSegura = (fechaTexto: string | null | undefined) => {
  if (!fechaTexto) return '-';
  
  // 1. Extraemos solo la fecha (ej: "2026-10-15"), ignorando si traía otra hora
  const soloFecha = fechaTexto.split('T')[0]; 
  
  // 2. Le inyectamos las 12 del mediodía clavadas (T12:00:00)
  const fechaMediodia = new Date(`${soloFecha}T12:00:00`);
  
  // 3. Devolvemos la fecha formateada sin riesgo de que se reste un día
  return fechaMediodia.toLocaleDateString('es-AR');
};