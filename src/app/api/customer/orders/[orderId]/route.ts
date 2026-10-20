import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderQrToken, verifyOrderQrToken } from '@/lib/crypto'
import { verifyMercadoPagoOrderPayment } from '@/lib/mercadopago'
import { getSessionUser, STAFF_ROLES } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(req.url)
    const paymentId =
      searchParams.get('payment_id') || searchParams.get('collection_id') || undefined
    const providedToken = searchParams.get('token') || undefined

    const sessionUser = await getSessionUser(req)

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
        user: { select: { id: true, fullName: true, dni: true, email: true } },
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

    // Verificar posesión / autorización sobre la orden
    const isOwner = Boolean(sessionUser && sessionUser.id === order.userId)
    const isStaff = Boolean(
      sessionUser &&
        STAFF_ROLES.includes(sessionUser.role) &&
        (sessionUser.role === 'SUPER_ADMIN' || sessionUser.tenantId === order.tenantId)
    )

    let hasValidToken = false
    if (providedToken) {
      const verified = verifyOrderQrToken(providedToken)
      hasValidToken = Boolean(verified.valid && verified.payload?.orderId === order.id)
    }

    let matchesCustomerCookie = false
    const rawCustomerCookie = req.cookies.get('bo_customer')?.value
    if (rawCustomerCookie && order.user) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawCustomerCookie))
        const cookieDni = String(parsed?.dni || '').replace(/\D/g, '')
        const cookieEmail = String(parsed?.email || '').trim().toLowerCase()
        if (
          (parsed?.userId && parsed.userId === order.userId) ||
          (cookieDni && order.user.dni && cookieDni === order.user.dni) ||
          (cookieEmail && order.user.email && cookieEmail === order.user.email.toLowerCase())
        ) {
          matchesCustomerCookie = true
        }
      } catch {}
    }

    if (!isOwner && !isStaff && !hasValidToken && !matchesCustomerCookie && !paymentId) {
      return NextResponse.json(
        { error: 'No tenés autorización para acceder a esta orden.' },
        { status: 403 }
      )
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
      id: order.id,
      tenantId: order.tenantId,
      status: order.status,
      totalAmount: order.totalAmount,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      items: order.items,
      user: {
        fullName: order.user?.fullName || 'Cliente',
        dni: order.user?.dni || '',
      },
      tenant: {
        slug: order.tenant.slug,
        name: order.tenant.name,
        isActive: order.tenant.isActive,
        subscriptionStatus: order.tenant.subscriptionStatus,
        defaultExpirationHour: order.tenant.defaultExpirationHour,
      },
    }

    return NextResponse.json({ order: safeOrder, qrToken })
  } catch (err) {
    console.error('[GET /api/customer/orders/[orderId]] Error:', err)
    return NextResponse.json({ error: 'Error al consultar la orden.' }, { status: 500 })
  }
}
