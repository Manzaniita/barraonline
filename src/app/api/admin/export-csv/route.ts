import { NextRequest, NextResponse } from 'next/server'
import { generateNightAuditCsv } from '@/lib/admin-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantSlug = searchParams.get('tenantSlug') || 'demo-club'

    const csvContent = await generateNightAuditCsv(tenantSlug)

    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `cierre-nocturno-${tenantSlug}-${dateStr}.csv`

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error: any) {
    console.error('Error generating CSV export:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error exportando auditoría nocturna' },
      { status: 500 }
    )
  }
}
