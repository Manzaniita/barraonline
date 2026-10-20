import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Tenant, Product } from '@prisma/client'
import { getTenantAndCatalog } from '@/lib/catalog-service'
import {
  getMercadoPagoClient,
  createMercadoPagoPreference,
  calculateExpirationDate,
  calculatePromoDeadline,
  CheckoutItemInput,
} from '@/lib/mercadopago'
import crypto from 'crypto'

type TenantWithProducts = Tenant & { products: Product[] }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tenantSlug, items, customer } = body

    if (!tenantSlug || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Datos de orden incompletos o inválidos.' },
        { status: 400 }
      )
    }

    if (!customer || (!customer.dni && !customer.email && !customer.userId) || !customer.fullName) {
      return NextResponse.json(
        { error: 'Iniciá sesión con tu cuenta antes de finalizar el pedido.' },
        { status: 400 }
      )
    }

    // 1. Obtener información del tenant y catálogo desde PostgreSQL
    const dbTenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: { products: true },
    })

    if (!dbTenant || !dbTenant.isActive || dbTenant.subscriptionStatus === 'CANCELLED') {
      return NextResponse.json(
        { error: 'La tienda no existe o no se encuentra disponible.' },
        { status: 404 }
      )
    }

    // 2. Validar precios, disponibilidad y stock contra el catálogo real del servidor
    const verifiedItems: CheckoutItemInput[] = []
    let totalAmount = 0

    for (const item of items) {
      const product = dbTenant.products.find((p) => p.id === item.productId)
      if (!product || !product.isActive) {
        return NextResponse.json(
          { error: `El producto solicitado ya no se encuentra disponible en la carta.` },
          { status: 400 }
        )
      }

      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1))
      if (product.stockAvailable < qty) {
        return NextResponse.json(
          {
            error:
              product.stockAvailable <= 0
                ? `"${product.name}" se quedó sin stock disponible.`
                : `Solo quedan ${product.stockAvailable} unidades disponibles de "${product.name}".`,
          },
          { status: 400 }
        )
      }

      const unitPrice = Number(product.price)
      totalAmount += unitPrice * qty

      verifiedItems.push({
        productId: product.id,
        name: product.name,
        unitPrice,
        quantity: qty,
        redeemDeadlineTime: product.redeemDeadlineTime,
      })
    }

    const orderId = crypto.randomUUID()
    const expiresAt = calculateExpirationDate(dbTenant.defaultExpirationHour || '07:00')
    const protocol = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    // 3. Persistir orden y descontar stock en transacción en PostgreSQL
    try {
      const cleanDni = (customer.dni || '').replace(/\D/g, '') || null
      const cleanEmail = customer.email?.trim().toLowerCase() || null

      let user = null
      if (customer.userId) {
        user = await prisma.user.findUnique({ where: { id: customer.userId } })
      }
      if (!user && cleanEmail) {
        user = await prisma.user.findFirst({ where: { email: cleanEmail } })
      }
      if (!user && cleanDni) {
        user = await prisma.user.findFirst({ where: { dni: cleanDni } })
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            tenantId: dbTenant.id,
            dni: cleanDni,
            email: cleanEmail,
            fullName: customer.fullName,
            phone: customer.phone || null,
            role: 'CUSTOMER',
          },
        })
      } else if (customer.fullName && user.fullName !== customer.fullName) {
        await prisma.user.update({
          where: { id: user.id },
          data: { fullName: customer.fullName },
        })
      }

      const orderItemsData = verifiedItems.map((item) => ({
        productId: item.productId,
        productNameSnapshot: item.name,
        unitPrice: item.unitPrice,
        quantityPurchased: item.quantity,
        quantityRedeemed: 0,
        redeemDeadlineAt: item.redeemDeadlineTime
          ? calculatePromoDeadline(item.redeemDeadlineTime)
          : null,
      }))

      await prisma.$transaction(async (tx) => {
        for (const item of verifiedItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockAvailable: {
                decrement: item.quantity,
              },
            },
          })
        }

        await tx.order.create({
          data: {
            id: orderId,
            tenantId: dbTenant.id,
            userId: user.id,
            status: dbTenant.mpAccessTokenEnc ? 'PENDING' : 'ACTIVE',
            totalAmount: totalAmount,
            expiresAt,
            items: {
              create: orderItemsData,
            },
          },
        })
      })
    } catch (dbErr) {
      console.error('[checkout/preference] Error persistiendo orden en PostgreSQL:', dbErr)
      return NextResponse.json(
        { error: 'No se pudo registrar el pedido en la base de datos.' },
        { status: 500 }
      )
    }

    // 4. Si el boliche tiene credenciales reales de Mercado Pago configuradas
    if (dbTenant?.mpAccessTokenEnc) {
      try {
        const mpClient = getMercadoPagoClient(dbTenant.mpAccessTokenEnc)
        const feePercentage = Number(dbTenant.feePercentage || 0)

        const preference = await createMercadoPagoPreference({
          client: mpClient,
          tenantSlug,
          orderId,
          items: verifiedItems,
          customer,
          feePercentage,
          baseUrl,
        })

        // Guardar preferenceId en la orden
        try {
          await prisma.order.update({
            where: { id: orderId },
            data: { mpPreferenceId: preference.preferenceId },
          })
        } catch {}

        return NextResponse.json({
          success: true,
          orderId,
          preferenceId: preference.preferenceId,
          initPoint: preference.initPoint,
          sandboxInitPoint: preference.sandboxInitPoint,
          isSimulated: false,
        })
      } catch (mpErr) {
        console.error('[checkout/preference] Error generando preferencia en Mercado Pago:', mpErr)
        // Fallback a modo demo si las credenciales fallan o son de prueba
      }
    }

    // 5. Modo Demo / Simulación (para pruebas instantáneas sin credenciales)
    return NextResponse.json({
      success: true,
      orderId,
      preferenceId: `pref-demo-${orderId.slice(0, 8)}`,
      initPoint: `/${tenantSlug}/orden/${orderId}?demo=true`,
      isSimulated: true,
      totalAmount,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('[checkout/preference] Error inesperado:', error)
    return NextResponse.json(
      { error: 'Error procesando la solicitud de pago.' },
      { status: 500 }
    )
  }
}
