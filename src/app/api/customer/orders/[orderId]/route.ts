import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderQrToken } from '@/lib/crypto'
import { verifyMercadoPagoOrderPayment } from '@/lib/mercadopago'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const { searchParams } = new URL(req.url)
  const paymentId =
    searchParams.get('payment_id') || searchParams.get('collection_id') || undefined

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
          isActive: true,
          subscriptionStatus: true,
          defaultExpirationHour: true,
          mpAccessTokenEnc: true,
        },
      },
      user: { select: { fullName: true, dni: true } },
    },
  })

  if (
    !order ||
    !order.tenant ||
    !order.tenant.isActive ||
    order.tenant.subscriptionStatus === 'CANCELLED'
  ) {
    return NextResponse.json({ error: 'Orden o tienda no encontrada' }, { status: 404 })
  }

  // Si la orden sigue en PENDING y el boliche tiene Access Token de Mercado Pago,
  // verificamos en vivo contra la API de Mercado Pago por si el usuario regresó antes que el webhook.
  if (order.status === 'PENDING' && order.tenant.mpAccessTokenEnc) {
    const verification = await verifyMercadoPagoOrderPayment({
      accessToken: order.tenant.mpAccessTokenEnc,
      orderId: order.id,
      paymentId,
    })

    if (verification.approved) {
      const { tokenHash } = generateOrderQrToken({
        orderId: order.id,
        tenantId: order.tenantId,
        userDni: order.user?.dni || undefined,
        expiresAt: order.expiresAt.toISOString(),
      })

      try {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'ACTIVE',
            mpPaymentId: verification.mpPaymentId || undefined,
            qrTokenHash: tokenHash,
          },
        })
        order.status = 'ACTIVE'
        order.qrTokenHash = tokenHash
      } catch (updateErr) {
        console.warn('[customer/orders] Error al activar orden verificada en MP:', updateErr)
      }
    } else if (verification.rejected) {
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            mpPaymentId: verification.mpPaymentId || undefined,
          },
        })
        order.status = 'CANCELLED'
      } catch {}
    }
  }

  let qrToken: string | null = null
  if (order.status === 'ACTIVE' || order.status === 'DEPLETED') {
    const tokenResult = generateOrderQrToken({
      orderId: order.id,
      tenantId: order.tenantId,
      userDni: order.user?.dni || undefined,
      expiresAt: order.expiresAt
        ? order.expiresAt.toISOString()
        : new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
    })
    qrToken = tokenResult.token
  }

  const safeOrder = {
    ...order,
    tenant: {
      slug: order.tenant.slug,
      name: order.tenant.name,
      isActive: order.tenant.isActive,
      subscriptionStatus: order.tenant.subscriptionStatus,
      defaultExpirationHour: order.tenant.defaultExpirationHour,
    },
  }

  return NextResponse.json({ order: safeOrder, qrToken })
}
