'use client'

interface MkTosQuote {
  id: string;
  quote_date: string;
  symbol: string;
  description: string;
  last_price: number;
  high_52: number;
  low_52: number;
  ema: number;
  low_100_day: number;
  high_price: number;
  low_price: number;
  bollinger_bands: number;
  sma_10w: number;
  mac_stop: number;
  trendpilot_stop: number;
  sma_10d: number;
  sma_100d: number;
}

interface MkTosTableProps {
  quotes: MkTosQuote[];
  cargando: boolean;
}

// Formateador numérico estilo financiero (Formato Argentina)
const formatNumber = (value: number) => {
  if (value === null || value === undefined) return '0,00';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function MkTosTable({ quotes, cargando }: MkTosTableProps) {
  if (cargando) {
    return <div className="text-center p-8 text-gray-500">Cargando cotizaciones...</div>;
  }

  if (!quotes || quotes.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow border border-gray-200 text-center text-gray-500">
        No hay cotizaciones activas para mostrar. Subí un archivo Quote para empezar.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
         <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Symbol</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Description</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Last</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">52High</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">52Low</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">TechTrader</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">100-day-Low</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">High</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Low</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">BBO</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">SMA 10W</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">MAC</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">TrendPilot</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">SMA 10d</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">SMA 100d</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-bold text-gray-900 whitespace-nowrap">{quote.symbol}</td>
                <td className="px-4 py-2 text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={quote.description}>{quote.description}</td>
                <td className="px-4 py-2 text-center text-gray-500 whitespace-nowrap">{quote.quote_date}</td>
                <td className="px-4 py-2 text-right font-medium text-gray-900 whitespace-nowrap">{formatNumber(quote.last_price)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.high_52)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.low_52)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.ema)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.low_100_day)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.high_price)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.low_price)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.bollinger_bands)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.sma_10w)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.mac_stop)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.trendpilot_stop)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.sma_10d)}</td>
                <td className="px-4 py-2 text-right text-gray-600 whitespace-nowrap">{formatNumber(quote.sma_100d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
        <span>Total de cotizaciones: <span className="font-bold">{quotes.length}</span></span>
        <span className="italic">Scaneado por ThinkOrSwim</span>
      </div>
    </div>
  )
}