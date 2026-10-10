// lib/formatters.ts

export const formatearMoneda = (valor: number | null | undefined) => {
  if (valor === null || valor === undefined) return '0,00';
  
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};