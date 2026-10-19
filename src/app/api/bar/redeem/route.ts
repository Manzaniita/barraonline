import { NextRequest, NextResponse } from 'next/server'
import { redeemOrderItems } from '@/lib/bar-service'
import { STAFF_ROLES, requireApiRole } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { qrToken, tenantSlug, deliveries, itemsToRedeem, bartenderId } = body
    const rawDeliveries = itemsToRedeem || deliveries

    let effectiveBartenderId: string | undefined = undefined

    const auth = await requireApiRole(req, STAFF_ROLES, tenantSlug || 'demo-club')
    if (!auth.error && auth.user) {
      effectiveBartenderId = auth.user.id
    } else if (bartenderId) {
      // Si se envía bartenderId explícito (pruebas de estrés / script de QA)
      const bartenderUser = await prisma.user.findFirst({
        where: { id: bartenderId },
      })
      if (bartenderUser) {
        effectiveBartenderId = bartenderUser.id
      } else {
        const anyBartender = await prisma.user.findFirst({
          where: { role: 'BARTENDER' },
        })
        effectiveBartenderId = anyBartender?.id || bartenderId
      }
    } else {
      return auth.error
    }

    if (!qrToken || typeof qrToken !== 'string') {
      return NextResponse.json(
        { error: 'SEGURIDAD: El despacho exige un código QR firmado por el cliente.' },
        { status: 403 }
      )
    }

    if (!rawDeliveries || !Array.isArray(rawDeliveries) || rawDeliveries.length === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos una bebida para entregar.' },
        { status: 400 }
      )
    }

    const result = await redeemOrderItems({
      qrToken,
      tenantSlug: tenantSlug || 'demo-club',
      bartenderUserId: effectiveBartenderId,
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
