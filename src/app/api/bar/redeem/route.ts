import { NextRequest, NextResponse } from 'next/server'
import { redeemOrderItems } from '@/lib/bar-service'
import { STAFF_ROLES, requireApiRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { qrToken, tenantSlug, deliveries, itemsToRedeem } = body
    const rawDeliveries = itemsToRedeem || deliveries

    const effectiveSlug =
      typeof tenantSlug === 'string' && tenantSlug.trim() ? tenantSlug.trim() : 'demo-club'

    const auth = await requireApiRole(req, STAFF_ROLES, effectiveSlug)
    if (auth.error) return auth.error

    if (!qrToken || typeof qrToken !== 'string') {
      return NextResponse.json(
        { error: 'SEGURIDAD: El despacho exige un código QR firmado por el cliente.' },
        { status: 403 }
      )
    }

    if (!rawDeliveries || !Array.isArray(rawDeliveries) || rawDeliveries.length === 0 || rawDeliveries.length > 50) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos una bebida válida para entregar.' },
        { status: 400 }
      )
    }

    const result = await redeemOrderItems({
      qrToken,
      tenantSlug: effectiveSlug,
      bartenderUserId: auth.user.id,
      deliveries: rawDeliveries,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Error despachando bebidas.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      redemptionLogIds: result.redemptionLogIds,
      order: result.order,
      redeemedItemsCount: result.redeemedItemsCount,
      isFullyRedeemed: result.isFullyRedeemed,
      message: 'Entrega confirmada y registrada en auditoría.',
    })
  } catch (err) {
    console.error('[api/bar/redeem] Error:', err)
    return NextResponse.json({ error: 'Error procesando entrega en barra.' }, { status: 500 })
  }
}
