import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import UploadMkTosCsv from '../../../components/UploadMkTosCsv'
import HistorialArchivosMkTos from '../../../components/HistorialArchivosMkTos'
import MkTosTable from '../../../components/MkTosTable'
import { getMkTosQuotes } from '../../../services/queries'

export const instant = false

interface Props {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    symbol?: string
  }>
}

export default async function MkTosPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const page = Math.max(1, parseInt(params?.page || '1', 10))
  const pageSize = Math.max(10, Math.min(200, parseInt(params?.pageSize || '50', 10)))
  const symbol = (params?.symbol || '').trim()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { quotes, count } = await getMkTosQuotes(supabase, { page, pageSize, symbol })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">MK-TOS</h1>
        <p className="text-gray-600 mt-2">
          Management of Quote statements with technical indicators.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <UploadMkTosCsv />
        <HistorialArchivosMkTos />
      </div>

      <MkTosTable 
        quotes={quotes || []} 
        totalCount={count || 0}
        currentPage={page}
        pageSize={pageSize}
        symbolFilter={symbol}
        cargando={false} 
      />
    </div>
  )
}