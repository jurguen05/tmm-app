import { NextResponse, connection } from 'next/server'
import { createClientSSR } from '../../../lib/supabaseServer'
import { getPortfolioConsistencyAudit } from '../../../services/queries'

export async function GET(request: Request) {
  try {
    await connection()
    const supabase = await createClientSSR()
    const audit = await getPortfolioConsistencyAudit(supabase)
    return NextResponse.json(audit)
  } catch (error: any) {
    if (error?.digest === 'HANGING_PROMISE_REJECTION' || (typeof error?.digest === 'string' && error.digest.startsWith('NEXT_'))) {
      throw error
    }
    console.error('[API /api/consistency-audit] Error:', error)
    return NextResponse.json(
      {
        hasIssues: false,
        maxSeverity: null,
        redCount: 0,
        yellowCount: 0,
        totalCount: 0,
        issues: [],
        auditedAt: new Date().toISOString(),
        error: error.message || 'Error executing consistency audit'
      },
      { status: 500 }
    )
  }
}
