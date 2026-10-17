import { NextRequest, NextResponse } from 'next/server'
import { lookupOrdersByDni } from '@/lib/bar-service'
import { STAFF_ROLES, requireApiRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const dni = searchParams.get('dni')
    const tenantSlug = searchParams.get('tenantSlug') || 'demo-club'

    const auth = await requireApiRole(req, STAFF_ROLES, tenantSlug)
    if (auth.error) return auth.error

    if (!dni) {
      return NextResponse.json({ error: 'DNI requerido para la búsqueda.' }, { status: 400 })
    }

    const result = await lookupOrdersByDni({ dni, tenantSlug })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/bar/lookup-dni] Error:', err)
    return NextResponse.json({ error: 'Error en búsqueda por DNI.' }, { status: 500 })
  }
}
