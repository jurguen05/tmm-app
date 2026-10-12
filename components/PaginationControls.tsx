'use client'

interface PaginationControlsProps {
  currentPage: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  itemName?: string
}

export default function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [15, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemName = 'registros'
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)

  // Calcular las páginas a mostrar con elipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', totalPages]
    }

    if (currentPage >= totalPages - 3) {
      return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages]
  }

  const pages = getPageNumbers()

  return (
    <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Resumen y selector de tamaño */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
        <div>
          Mostrando <span className="font-semibold text-gray-900">{from}</span> a{' '}
          <span className="font-semibold text-gray-900">{to}</span> de{' '}
          <span className="font-semibold text-gray-900">{totalItems}</span> {itemName}
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value))
              }}
              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Botones de navegación */}
      <div className="flex items-center gap-1 text-sm">
        {/* Primera página */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="Primera página"
          className="px-2.5 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
        >
          ««
        </button>

        {/* Anterior */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
        >
          Anterior
        </button>

        {/* Números de página */}
        <div className="hidden md:flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400 select-none text-xs">
                  …
                </span>
              )
            }
            const pageNum = p as number
            const isCurrent = pageNum === currentPage
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[32px] h-8 px-2 rounded text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>

        {/* Indicador de página en mobile */}
        <span className="md:hidden text-xs text-gray-600 px-2 font-medium">
          {currentPage} / {totalPages}
        </span>

        {/* Siguiente */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
        >
          Siguiente
        </button>

        {/* Última página */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Última página"
          className="px-2.5 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
        >
          »»
        </button>
      </div>
    </div>
  )
}
