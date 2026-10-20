import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySessionToken } from '@/lib/auth-service'

export const dynamic = 'force-dynamic'

/**
 * Consulta el estado en vivo de los pedidos y QRs del cliente.
 * Detecta canjes parciales, totales y vencimientos en tiempo real.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { tenantSlug, orderIds = [], userDni } = body

    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, isActive: true, subscriptionStatus: true },
      })
      if (!tenant || !tenant.isActive || tenant.subscriptionStatus === 'CANCELLED') {
        return NextResponse.json({
          success: true,
          tenantDeleted: true,
          activeOrders: [],
          historyOrders: [],
          serverTime: new Date().toISOString(),
        })
      }
    }

    // 1. Obtener usuario autenticado si existe sesión firmada
    let sessionUserId: string | null = null
    const sessionCookie = req.cookies.get('bo_session')?.value
    if (sessionCookie) {
      const auth = verifySessionToken(sessionCookie)
      if (auth?.id) sessionUserId = auth.id
    }

    // 2. Construir condiciones de búsqueda seguras (prohibida la enumeración por DNI sin sesión)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const orConditions: any[] = []

    if (Array.isArray(orderIds) && orderIds.length > 0) {
      const validIds = orderIds
        .filter((id): id is string => typeof id === 'string' && UUID_REGEX.test(id.trim()))
        .slice(0, 25)
      if (validIds.length > 0) {
        orConditions.push({ id: { in: validIds } })
      }
    }

    if (sessionUserId) {
      orConditions.push({ userId: sessionUserId })
    }

    // Si no hay condiciones válidas, retornar arrays vacíos
    if (orConditions.length === 0) {
      return NextResponse.json({
        success: true,
        activeOrders: [],
        historyOrders: [],
        serverTime: new Date().toISOString(),
      })
    }

    // 3. Consultar órdenes en PostgreSQL
    const orders = await prisma.order.findMany({
      where: {
        AND: [
          { OR: orConditions },
          tenantSlug ? { tenant: { slug: tenantSlug } } : {},
        ],
      },
      include: {
        items: {
          include: { product: true },
        },
        redemptions: {
          include: {
            bartender: { select: { id: true, fullName: true } },
            substitutedProduct: { select: { id: true, name: true } },
          },
        },
        user: true,
        tenant: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const now = new Date()
    const activeOrders: any[] = []
    const historyOrders: any[] = []

    for (const order of orders) {
      const expiresAtDate = new Date(order.expiresAt)
      const isExpiredByTime = now > expiresAtDate

      // Calcular totales de compra vs canjes
      let totalPurchased = 0
      let totalRedeemed = 0

      for (const item of order.items) {
        totalPurchased += item.quantityPurchased
        totalRedeemed += item.quantityRedeemed
      }

      let currentStatus = order.status

      // 4. Auto-actualizar estado en base de datos si expiró
      if (isExpiredByTime && currentStatus === 'ACTIVE') {
        currentStatus = 'EXPIRED'
        try {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'EXPIRED' },
          })
        } catch {}
      }

      // Auto-actualizar si todos los tragos fueron entregados
      if (totalRedeemed >= totalPurchased && totalPurchased > 0 && currentStatus === 'ACTIVE') {
        currentStatus = 'DEPLETED'
        try {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'DEPLETED' },
          })
        } catch {}
      }

      const isFullyRedeemed = totalRedeemed >= totalPurchased && totalPurchased > 0
      const isPartiallyRedeemed = totalRedeemed > 0 && totalRedeemed < totalPurchased
      const isExpired = isExpiredByTime || currentStatus === 'EXPIRED'
      const isActive = !isFullyRedeemed && !isExpired && currentStatus === 'ACTIVE'

      // Desglose de ítems con cantidades entregadas vs disponibles
      const itemsDetail = order.items.map((item) => {
        const remaining = Math.max(0, item.quantityPurchased - item.quantityRedeemed)
        return {
          orderItemId: item.id,
          productId: item.productId,
          name: item.productNameSnapshot,
          quantityPurchased: item.quantityPurchased,
          quantityRedeemed: item.quantityRedeemed,
          quantityAvailable: remaining,
          unitPrice: Number(item.unitPrice),
          isFullyRedeemed: item.quantityRedeemed >= item.quantityPurchased,
          isPartiallyRedeemed: item.quantityRedeemed > 0 && item.quantityRedeemed < item.quantityPurchased,
        }
      })

      // Timeline de eventos de redención en barra
      const validRedemptions = order.redemptions
        .filter((r) => !r.isReverted)
        .sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime())
        .map((r) => {
          const matchedItem = order.items.find((i) => i.id === r.orderItemId)
          return {
            id: r.id,
            productName: r.substitutedProduct?.name || matchedItem?.productNameSnapshot || 'Bebida',
            quantity: r.quantityDelivered,
            bartenderName: r.bartender?.fullName || 'Bartender de Barra',
            redeemedAt: r.redeemedAt.toISOString(),
          }
        })

      // Si venció y quedaron tragos sin canjear, registrar ítems no retirados
      const unredeemedItems =
        isExpired && !isFullyRedeemed
          ? itemsDetail
              .filter((it) => it.quantityAvailable > 0)
              .map((it) => ({
                name: it.name,
                quantity: it.quantityAvailable,
                reason: 'No canjeado antes del cierre de barra (Vencido)',
              }))
          : []

      const formattedOrder = {
        orderId: order.id,
        tenantSlug: order.tenant?.slug || tenantSlug,
        nightclubName: order.tenant?.name || 'Club Nocturno',
        customerName: order.user?.fullName || 'Cliente',
        customerDni: order.user?.dni || '',
        totalAmount: Number(order.totalAmount),
        status: currentStatus,
        createdAt: order.createdAt.toISOString(),
        expiresAt: order.expiresAt.toISOString(),
        isExpired,
        isFullyRedeemed,
        isPartiallyRedeemed,
        totalPurchased,
        totalRedeemed,
        totalAvailable: Math.max(0, totalPurchased - totalRedeemed),
        items: itemsDetail,
        redemptions: validRedemptions,
        unredeemedItems,
      }

      if (isActive) {
        activeOrders.push(formattedOrder)
      } else {
        historyOrders.push(formattedOrder)
      }
    }

    return NextResponse.json({
      success: true,
      activeOrders,
      historyOrders,
      serverTime: now.toISOString(),
    })
  } catch (error: any) {
    console.error('[POST /api/customer/orders] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al consultar órdenes.' },
      { status: 500 }
    )
  }
}
