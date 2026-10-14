'use client'

import { useState, useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { formatearFecha } from '../lib/formatters';
import PaginationControls from './PaginationControls';

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
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  symbolFilter?: string;
  cargando?: boolean;
  latestFileName?: string;
  isFiltered?: boolean;
}

const formatNumber = (value: number) => {
  if (value === null || value === undefined) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function MkTosTable({
  quotes,
  totalCount = 0,
  currentPage = 1,
  pageSize = 50,
  symbolFilter = '',
  latestFileName,
  isFiltered = false,
  cargando = false
}: MkTosTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [inputBusqueda, setInputBusqueda] = useState(symbolFilter);

  useEffect(() => {
    setInputBusqueda(symbolFilter);
  }, [symbolFilter]);

  const updateUrl = (newPage: number, newPageSize: number, newSymbol: string) => {
    const current = new URLSearchParams(Array.from(searchParams?.entries() || []));
    if (newPage > 1) {
      current.set('page', String(newPage));
    } else {
      current.delete('page');
    }

    if (newPageSize !== 50) {
      current.set('pageSize', String(newPageSize));
    } else {
      current.delete('pageSize');
    }

    if (newSymbol.trim()) {
      current.set('symbol', newSymbol.trim());
    } else {
      current.delete('symbol');
    }

    const query = current.toString() ? `?${current.toString()}` : '';
    startTransition(() => {
      router.push(`${pathname}${query}`);
    });
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl(1, pageSize, inputBusqueda);
  };

  const handleLimpiarBusqueda = () => {
    setInputBusqueda('');
    updateUrl(1, pageSize, '');
  };

  if (cargando) {
    return <div className="text-center p-8 text-gray-500">Loading quotes...</div>;
  }

  const effectiveTotal = totalCount > 0 ? totalCount : quotes.length;

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleBuscar} className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Filter by Symbol:</label>
            <input
              type="text"
              placeholder="e.g. AAPL, TSLA, SPY..."
              value={inputBusqueda}
              onChange={(e) => setInputBusqueda(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 w-44 uppercase"
            />
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isPending ? 'Searching...' : 'Search'}
            </button>
            {symbolFilter && (
              <button
                type="button"
                onClick={handleLimpiarBusqueda}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline cursor-pointer ml-1"
              >
                Clear
              </button>
            )}
          </form>

          {/* Badge de contexto visual */}
          {symbolFilter ? (
            <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full font-medium">
              Searching entire history for: <strong>{symbolFilter}</strong>
            </span>
          ) : latestFileName ? (
            <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">
              Visual control: Showing latest file <strong>{latestFileName}</strong>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {isPending && (
            <span className="text-xs text-indigo-600 animate-pulse font-medium">
              Updating...
            </span>
          )}
          <div className="text-xs text-gray-500 font-medium">
            {effectiveTotal} {effectiveTotal === 1 ? 'quote' : 'quotes'}
          </div>
        </div>
      </div>

      {/* Contenedor de la Tabla */}
      <div className={`bg-white rounded-lg shadow border border-gray-200 overflow-hidden transition-opacity ${isPending ? 'opacity-60' : 'opacity-100'}`}>
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
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-6 py-8 text-center text-gray-500">
                    {symbolFilter 
                      ? `No quotes found matching "${symbolFilter}" across uploaded files.` 
                      : `No quotes found in latest uploaded file (${latestFileName || 'none'}). Upload a Quotes file to start.`}
                  </td>
                </tr>
              ) : (
                quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-bold text-gray-900 whitespace-nowrap">{quote.symbol}</td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={quote.description}>{quote.description}</td>
                    <td className="px-4 py-2 text-center text-gray-500 whitespace-nowrap">{formatearFecha(quote.quote_date)}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Controles de Paginación */}
        {effectiveTotal > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalItems={effectiveTotal}
            pageSize={pageSize}
            pageSizeOptions={[25, 50, 100, 200]}
            onPageChange={(page) => updateUrl(page, pageSize, symbolFilter)}
            onPageSizeChange={(newSize) => updateUrl(1, newSize, symbolFilter)}
            itemName="quotes"
          />
        )}
      </div>
    </div>
  );
}