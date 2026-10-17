import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderQrToken } from '@/lib/crypto'
import { calculateExpirationDate, calculatePromoDeadline } from '@/lib/mercadopago'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, tenantSlug = 'demo-club', userDni, customerName, items, totalAmount } = body

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 })
    }

    const cleanDni = userDni ? String(userDni).replace(/\D/g, '') : '42123456'
    const expiresAtDate = calculateExpirationDate('07:00')
    const expiresAt = expiresAtDate.toISOString()

    // 1. Obtener tenant de la base de datos
    let tenant = null
    try {
      tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        include: { products: true },
      })
    } catch (err) {
      console.warn('[simulate-payment] No se pudo obtener tenant de DB:', err)
    }

    const tenantId = tenant ? tenant.id : `tenant-${tenantSlug}`

    // 2. Generar el token QR real y firmado criptográficamente con el tenantId real
    const { token, tokenHash } = generateOrderQrToken({
      orderId,
      tenantId,
      userDni: cleanDni,
      expiresAt,
    })

    // 3. Persistir o actualizar en base de datos PostgreSQL
    let dbOrder = null
    if (tenant) {
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
          // Si la orden aún no existía en la DB, buscar o crear el usuario y crear la orden
          let user = await prisma.user.findFirst({
            where: { dni: cleanDni },
          })

          if (!user) {
            user = await prisma.user.create({
              data: {
                tenantId: tenant.id,
                dni: cleanDni,
                fullName: customerName || 'Cliente',
                role: 'CUSTOMER',
              },
            })
          }

          // Armar items válidos vinculados a productos de Supabase
          const prods = tenant.products
          const fernet = prods.find((p) => p.name.includes('Fernet')) || prods[0]
          const agua = prods.find((p) => p.name.includes('Agua')) || prods[1] || prods[0]

          const itemsToCreate =
            items && Array.isArray(items) && items.length > 0
              ? items.map((it: any) => {
                  const matched =
                    prods.find((p) => p.id === it.productId) ||
                    prods.find((p) => p.name.toLowerCase() === (it.name || '').toLowerCase()) ||
                    prods[0]

                  return {
                    productId: matched ? matched.id : fernet.id,
                    productNameSnapshot: it.name || (matched ? matched.name : 'Bebida'),
                    unitPrice: it.unitPrice || (matched ? Number(matched.price) : 6500),
                    quantityPurchased: it.quantity || 1,
                    quantityRedeemed: 0,
                    redeemDeadlineAt: it.redeemDeadlineTime
                      ? calculatePromoDeadline(it.redeemDeadlineTime)
                      : null,
                  }
                })
              : [
                  {
                    productId: fernet.id,
                    productNameSnapshot: fernet.name,
                    unitPrice: Number(fernet.price),
                    quantityPurchased: 2,
                    quantityRedeemed: 0,
                  },
                  {
                    productId: agua.id,
                    productNameSnapshot: agua.name,
                    unitPrice: Number(agua.price),
                    quantityPurchased: 1,
                    quantityRedeemed: 0,
                  },
                ]

          const finalTotal =
            totalAmount ||
            itemsToCreate.reduce((sum: number, it: any) => sum + it.unitPrice * it.quantityPurchased, 0)

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
      }
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
