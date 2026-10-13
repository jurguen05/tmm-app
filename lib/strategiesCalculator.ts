// lib/strategiesCalculator.ts

import { Position, Transaction } from '../types';

export interface ConsolidatedStrategyStop {
  id: string;
  trade_code: string;
  symbol: string;
  strategy: string;
  entryPrice: number;
  lastPrice: number;
  stop: string | number;
  rentabilidad: number;
}

/**
 * Función pura de dominio que consolida las posiciones activas con su historial de transacciones,
 * calculando el trade actual, estrategia asignada, precio de entrada y rentabilidad.
 */
export const consolidarStrategiesStops = (
  positions: Position[],
  transactions: Transaction[]
): ConsolidatedStrategyStop[] => {
  if (!positions || positions.length === 0) return [];

  const consolidado: ConsolidatedStrategyStop[] = positions.map((pos) => {
    const txsDelCodigo = transactions?.filter(t => t.unique_key === pos.unique_key) || [];
    
    // Filtrar transacciones abiertas ordenadas de más reciente a más antigua
    const txsOpen = txsDelCodigo.filter(t => t.position_status?.toLowerCase() === 'open');
    const txsOpenOrdenadas = [...txsOpen].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const trade_code = txsOpenOrdenadas.length > 0 && txsOpenOrdenadas[0].trade_code !== null && txsOpenOrdenadas[0].trade_code !== undefined
      ? String(txsOpenOrdenadas[0].trade_code) 
      : '-';
      
    const strategy = txsOpenOrdenadas.length > 0
      ? (txsOpenOrdenadas[0].strategies?.name || txsOpenOrdenadas[0].strategy || 'S/D')
      : 'S/D';

    // Para el trade actual, buscar la primera compra cronológica para definir el precio de entrada
    const txsDelTradeActual = txsDelCodigo.filter(t => String(t.trade_code) === String(trade_code));
    const txsOrdenadasFechas = [...txsDelTradeActual].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const primeraCompra = txsOrdenadasFechas.find(t => t.amount < 0) || txsOrdenadasFechas[0];
    
    const entryPrice = primeraCompra ? (primeraCompra.stock_entry_price || primeraCompra.price || 0) : 0;
    const lastPrice = pos.stock_last || 0;

    let rentabilidad = 0;
    if (entryPrice > 0 && lastPrice > 0) {
      rentabilidad = (lastPrice / entryPrice) - 1;
    }

    return {
      id: pos.id,
      trade_code: trade_code,
      symbol: pos.symbol,
      strategy: strategy,
      entryPrice: entryPrice,
      lastPrice: lastPrice,
      stop: '-', 
      rentabilidad: rentabilidad
    };
  });

  return consolidado.sort((a, b) => a.symbol.localeCompare(b.symbol));
};
