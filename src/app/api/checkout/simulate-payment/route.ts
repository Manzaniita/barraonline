import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/config/env'
import { prisma } from '@/lib/prisma'
import { generateOrderQrToken } from '@/lib/crypto'
import { calculateExpirationDate, calculatePromoDeadline } from '@/lib/mercadopago'

export async function POST(req: NextRequest) {
  if (!env.ALLOW_PAYMENT_SIMULATION) {
    return NextResponse.json(
      { error: 'Simulación de pagos deshabilitada en este entorno.' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { orderId, tenantSlug, userDni, customerName, items, totalAmount } = body

    if (!orderId || !tenantSlug) {
      return NextResponse.json({ error: 'orderId y tenantSlug son requeridos' }, { status: 400 })
    }

    const cleanDni = userDni ? String(userDni).replace(/\D/g, '') : ''

    // 1. Obtener tenant de la base de datos
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: { products: true },
    })

    if (!tenant || !tenant.isActive || tenant.subscriptionStatus === 'CANCELLED') {
      return NextResponse.json({ error: 'La tienda no existe o está inactiva.' }, { status: 404 })
    }

    const expiresAtDate = calculateExpirationDate(tenant.defaultExpirationHour || '07:00')
    const expiresAt = expiresAtDate.toISOString()
    const tenantId = tenant.id

    // 2. Generar el token QR real y firmado criptográficamente con el tenantId real
    const { token, tokenHash } = generateOrderQrToken({
      orderId,
      tenantId,
      userDni: cleanDni || undefined,
      expiresAt,
    })

    // 3. Persistir o actualizar en base de datos PostgreSQL
    let dbOrder = null
    try {
      const existing = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          user: true,
        },
      })

      if (existing) {
        dbOrder = await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'ACTIVE',
            mpPaymentId: `sim-pay-${Date.now()}`,
            qrTokenHash: tokenHash,
          },
          include: {
            items: { include: { product: true } },
            user: true,
          },
        })
      } else {
        if (!items || !Array.isArray(items) || items.length === 0) {
          return NextResponse.json(
            { error: 'La orden no existe y no se especificaron productos válidos.' },
            { status: 400 }
          )
        }

        let user = cleanDni
          ? await prisma.user.findFirst({
              where: { dni: cleanDni },
            })
          : null

        if (!user) {
          user = await prisma.user.create({
            data: {
              tenantId: tenant.id,
              dni: cleanDni || null,
              fullName: customerName || 'Cliente',
              role: 'CUSTOMER',
            },
          })
        }

        const prods = tenant.products
        interface SimItemInput {
          productId?: string
          name?: string
          unitPrice?: number
          quantity?: number
          redeemDeadlineTime?: string
        }

        const itemsToCreate = []
        for (const it of items as SimItemInput[]) {
          const matched =
            prods.find((p) => p.id === it.productId) ||
            prods.find((p) => p.name.toLowerCase() === (it.name || '').toLowerCase())

          if (!matched || !matched.isActive) {
            return NextResponse.json(
              { error: `Producto "${it.name || it.productId}" no existe o está inactivo.` },
              { status: 400 }
            )
          }

          itemsToCreate.push({
            productId: matched.id,
            productNameSnapshot: matched.name,
            unitPrice: Number(matched.price),
            quantityPurchased: Math.max(1, Number(it.quantity) || 1),
            quantityRedeemed: 0,
            redeemDeadlineAt: matched.redeemDeadlineTime
              ? calculatePromoDeadline(matched.redeemDeadlineTime)
              : null,
          })
        }

        const finalTotal =
          totalAmount ||
          itemsToCreate.reduce(
            (sum: number, it: { unitPrice: number; quantityPurchased: number }) =>
              sum + it.unitPrice * it.quantityPurchased,
            0
          )

        dbOrder = await prisma.order.create({
          data: {
            id: orderId,
            tenantId: tenant.id,
            userId: user.id,
            status: 'ACTIVE',
            totalAmount: finalTotal,
            expiresAt: expiresAtDate,
            qrTokenHash: tokenHash,
            mpPaymentId: `sim-pay-${Date.now()}`,
            items: {
              create: itemsToCreate,
            },
          },
          include: {
            items: { include: { product: true } },
            user: true,
          },
        })
      }
    } catch (err) {
      console.error('[simulate-payment] Error al guardar/actualizar orden en DB:', err)
      return NextResponse.json({ error: 'Error al registrar la orden en DB.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status: 'ACTIVE',
      orderId,
      qrToken: token,
      tokenHash,
      expiresAt,
      order: dbOrder
        ? {
            id: dbOrder.id,
            totalAmount: Number(dbOrder.totalAmount),
            customerName: dbOrder.user?.fullName,
            customerDni: dbOrder.user?.dni,
            items: dbOrder.items.map((i) => ({
              name: i.productNameSnapshot,
              quantity: i.quantityPurchased,
              unitPrice: Number(i.unitPrice),
            })),
          }
        : null,
      message: 'Pago simulado aprobado exitosamente. Orden activada con QR firmado.',
    })
  } catch (error) {
    console.error('[simulate-payment] Error:', error)
    return NextResponse.json({ error: 'Error simulando pago' }, { status: 500 })
  }
}
