import { NextRequest, NextResponse } from 'next/server'
import { getClubDashboardMetrics } from '@/lib/admin-service'
import { ADMIN_ROLES, requireApiRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantSlug = searchParams.get('tenantSlug') || 'demo-club'

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    const metrics = await getClubDashboardMetrics(tenantSlug)

    if (!metrics) {
      return NextResponse.json(
        { success: false, error: 'Boliche no encontrado o sin datos' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      metrics,
    })
  } catch (error: any) {
    console.error('Error fetching admin metrics:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
