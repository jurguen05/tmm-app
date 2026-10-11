'use client'

interface StrategyData {
  id: string;
  trade_code: string; // <-- AHORA ES trade_code
  symbol: string;
  strategy: string;
  entryPrice: number;
  lastPrice: number;
  stop: string | number; // Por ahora será un string vacío o "-"
  rentabilidad: number;
}

interface TableProps {
  datos: StrategyData[];
  cargando: boolean;
}

// Formateador de moneda (Argentina)
const formatoMoneda = (valor: number) => {
  if (!valor) return '0,00';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
};

// Formateador de porcentaje
const formatoPorcentaje = (valor: number) => {
  if (!valor) return '0,00%';
  return new Intl.NumberFormat('es-AR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
};

export default function StrategiesStopsTable({ datos, cargando }: TableProps) {
  if (cargando) {
    return <div className="text-center p-8 text-gray-500">Cruzando datos y calculando métricas...</div>;
  }

  if (!datos || datos.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow border border-gray-200 text-center text-gray-500">
        No hay posiciones vigentes para analizar.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Código</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Symbol</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Strategy</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Entry Price</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Last</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Stop</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rentabilidad</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {datos.map((fila) => (
              <tr key={fila.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{fila.trade_code}</td> {/* <-- AHORA ES trade_code */}
                <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{fila.symbol}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-semibold">
                    {fila.strategy}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{formatoMoneda(fila.entryPrice)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{formatoMoneda(fila.lastPrice)}</td>
                <td className="px-4 py-3 text-right text-gray-400 whitespace-nowrap italic">{fila.stop}</td>
                <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${fila.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatoPorcentaje(fila.rentabilidad)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}