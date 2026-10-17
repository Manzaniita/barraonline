import { NextRequest, NextResponse } from 'next/server'
import { redeemOrderItems } from '@/lib/bar-service'
import { STAFF_ROLES, requireApiRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { qrToken, tenantSlug, deliveries } = body

    const auth = await requireApiRole(req, STAFF_ROLES, tenantSlug || 'demo-club')
    if (auth.error) return auth.error

    if (!qrToken || typeof qrToken !== 'string') {
      return NextResponse.json(
        { error: 'SEGURIDAD: El despacho exige un código QR firmado por el cliente.' },
        { status: 403 }
      )
    }

    if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos una bebida para entregar.' },
        { status: 400 }
      )
    }

    const result = await redeemOrderItems({
      qrToken,
      tenantSlug: tenantSlug || 'demo-club',
      bartenderUserId: auth.user.id,
      deliveries,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Error despachando bebidas.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      redemptionLogIds: result.redemptionLogIds,
      message: 'Entrega confirmada y registrada en auditoría.',
    })
  } catch (err) {
    console.error('[api/bar/redeem] Error:', err)
    return NextResponse.json({ error: 'Error procesando entrega en barra.' }, { status: 500 })
  }
}
