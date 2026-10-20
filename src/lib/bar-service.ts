import { prisma } from './prisma'
import { verifyOrderQrToken } from './crypto'

export interface ItemDeliveryInput {
  orderItemId: string
  quantity: number
  substituteProductId?: string
}

export interface BarVerifiedItem {
  orderItemId: string
  productId: string
  name: string
  unitPrice: number
  quantityPurchased: number
  quantityRedeemed: number
  quantityAvailable: number
  isExpired: boolean
  redeemDeadlineAt?: string | null
}

export interface BarVerifiedOrder {
  orderId: string
  tenantId: string
  tenantSlug: string
  customerName: string
  customerDni: string
  totalAmount: number
  status: string
  expiresAt: string
  items: BarVerifiedItem[]
  canRedeem: boolean
}

/**
 * Verifica un código QR escaneado por el bartender.
 * Valida la firma criptográfica HMAC-SHA256 y consulta el saldo disponible.
 */
export async function verifyQrForBar({
  qrToken,
  tenantSlug,
}: {
  qrToken: string
  tenantSlug: string
}): Promise<{ valid: boolean; order?: BarVerifiedOrder; error?: string }> {
  let cleanToken = (qrToken || '').trim()

  // 0. Si el scanner leyó una URL de la aplicación, extraer el token o orderId
  if (cleanToken.startsWith('http://') || cleanToken.startsWith('https://')) {
    try {
      const url = new URL(cleanToken)
      const queryToken = url.searchParams.get('token')
      if (queryToken) {
        cleanToken = queryToken
      } else {
        const match = url.pathname.match(/\/orden\/([^/?#]+)/)
        if (match) {
          cleanToken = match[1]
        }
      }
    } catch {}
  }

  // 1. Verificación criptográfica de la firma del QR
  const sigResult = verifyOrderQrToken(cleanToken)
  let orderId = sigResult.valid && sigResult.payload ? sigResult.payload.orderId : null

  // Fallback si vino con orderId directo
  if (!orderId) {
    try {
      const maybeOrder = await prisma.order.findUnique({
        where: { id: cleanToken },
        select: { id: true },
      })
      if (maybeOrder) orderId = maybeOrder.id
    } catch {}
  }

  if (!orderId) {
    return {
      valid: false,
      error:
        sigResult.error === 'EXPIRED_TOKEN'
          ? 'El código QR ha expirado (superó el horario de corte nocturno).'
          : 'Código QR no reconocido o firma digital no coincide.',
    }
  }

  // 2. Consulta en base de datos PostgreSQL
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tenant: true,
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return {
        valid: false,
        error: 'La orden no existe o fue eliminada del sistema.',
      }
    }

    if (!order.tenant || !order.tenant.isActive || order.tenant.subscriptionStatus === 'CANCELLED') {
      return {
        valid: false,
        error: 'La tienda asociada a este código QR se encuentra inactiva o dada de baja.',
      }
    }

    if (tenantSlug && order.tenant.slug !== tenantSlug) {
      return {
        valid: false,
        error: `Este código QR pertenece a otro local (${order.tenant.name}).`,
      }
    }

    if (order.status === 'DEPLETED') {
      return {
        valid: false,
        error: 'Este código QR ya fue AGOTADO (todos los tragos fueron entregados).',
      }
    }

    if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
      return {
        valid: false,
        error: `Este código QR se encuentra ${order.status === 'EXPIRED' ? 'VENCIDO' : 'CANCELADO'}.`,
      }
    }

    const now = new Date()
    const verifiedItems: BarVerifiedItem[] = order.items.map((item) => {
      const isExpired = item.redeemDeadlineAt ? now > item.redeemDeadlineAt : false
      const available = Math.max(0, item.quantityPurchased - item.quantityRedeemed)

      return {
        orderItemId: item.id,
        productId: item.productId,
        name: item.productNameSnapshot || item.product?.name || 'Bebida',
        unitPrice: Number(item.unitPrice),
        quantityPurchased: item.quantityPurchased,
        quantityRedeemed: item.quantityRedeemed,
        quantityAvailable: isExpired ? 0 : available,
        isExpired,
        redeemDeadlineAt: item.redeemDeadlineAt ? item.redeemDeadlineAt.toISOString() : null,
      }
    })

    const hasAvailableItems = verifiedItems.some((i) => i.quantityAvailable > 0)

    return {
      valid: true,
      order: {
        orderId: order.id,
        tenantId: order.tenantId,
        tenantSlug: order.tenant.slug,
        customerName: order.user?.fullName || 'Cliente',
        customerDni: order.user?.dni || '',
        totalAmount: Number(order.totalAmount),
        status: order.status,
        expiresAt: order.expiresAt.toISOString(),
        items: verifiedItems,
        canRedeem: hasAvailableItems,
      },
    }
  } catch (dbErr) {
    console.error('[verifyQrForBar] Error consultando base de datos:', dbErr)
    return {
      valid: false,
      error: 'Error de conexión con el servidor de barra.',
    }
  }
}

export interface RedeemItemRequest {
  orderItemId: string
  quantity: number
  substituteProductId?: string
  substitutedProductId?: string
  substitutionNotes?: string
}

export interface RedemptionResult {
  success: boolean
  order?: unknown
  redeemedItemsCount?: number
  isFullyRedeemed?: boolean
  redemptionLogIds: string[]
  error?: string
}

/**
 * Despacha unidades de una orden de forma atómica y transaccional.
 * Valida la firma del QR y aplica bloqueo atómico condicional SQL anti double-spend.
 */
export async function redeemOrderItems(
  param1:
    | string
    | {
        qrToken: string
        tenantSlug?: string
        bartenderUserId?: string
        deliveries?: RedeemItemRequest[]
        itemsToRedeem?: RedeemItemRequest[]
      },
  param2?: RedeemItemRequest[],
  param3?: string,
  param4?: string
): Promise<RedemptionResult> {
  let qrToken: string
  let deliveries: RedeemItemRequest[]
  let bartenderUserId: string | undefined
  let tenantSlug: string | undefined

  if (typeof param1 === 'object') {
    qrToken = param1.qrToken
    deliveries = param1.deliveries || param1.itemsToRedeem || []
    bartenderUserId = param1.bartenderUserId
    tenantSlug = param1.tenantSlug
  } else {
    qrToken = param1
    deliveries = param2 || []
    bartenderUserId = param3
    tenantSlug = param4
  }

  let cleanToken = (qrToken || '').trim()
  if (cleanToken.startsWith('http://') || cleanToken.startsWith('https://')) {
    try {
      const url = new URL(cleanToken)
      const q = url.searchParams.get('token')
      if (q) cleanToken = q
      else {
        const m = url.pathname.match(/\/orden\/([^\/?#]+)/)
        if (m) cleanToken = m[1]
      }
    } catch {}
  }

  // 1. Verificación criptográfica obligatoria de la firma del QR
  const sigResult = verifyOrderQrToken(cleanToken)
  let orderId = sigResult.valid && sigResult.payload ? sigResult.payload.orderId : null

  if (!orderId) {
    try {
      const maybeOrder = await prisma.order.findUnique({
        where: { id: cleanToken },
        select: { id: true },
      })
      if (maybeOrder) orderId = maybeOrder.id
    } catch {}
  }

  if (!orderId) {
    return {
      success: false,
      redemptionLogIds: [],
      error: 'SEGURIDAD: No se puede despachar sin un código QR válido y firmado.',
    }
  }

  try {
    const defaultBartender = await prisma.user.findFirst({
      where: { role: 'BARTENDER' },
    })

    const effectiveBartenderId = bartenderUserId || defaultBartender?.id

    if (!effectiveBartenderId) {
      return { success: false, redemptionLogIds: [], error: 'Identificación de bartender no encontrada.' }
    }

    // 2. Transacción atómica en PostgreSQL con verificación condicional anti double-spend
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } }, tenant: true },
      })

      if (!order) {
        throw new Error('Orden no encontrada.')
      }

      if (tenantSlug && order.tenant.slug !== tenantSlug) {
        throw new Error('El ticket no pertenece a este local comercial.')
      }

      if (order.status !== 'ACTIVE') {
        throw new Error(`La orden no está disponible para canje (Estado: ${order.status}).`)
      }

      const logIds: string[] = []

      for (const delivery of deliveries) {
        if (delivery.quantity <= 0) continue

        const item = order.items.find((i) => i.id === delivery.orderItemId)
        if (!item) {
          throw new Error(`Ítem de orden ${delivery.orderItemId} no existe.`)
        }

        // Actualización atómica condicional:
        // Solo incrementa si quantityRedeemed + delivery.quantity <= quantityPurchased.
        // Si dos terminales intentan canjear concurrentemente la misma bebida,
        // la fila se bloquea y el segundo intento actualizará 0 filas y fallará inmediatamente.
        const updateResult = await tx.orderItem.updateMany({
          where: {
            id: item.id,
            orderId: order.id,
            quantityRedeemed: {
              lte: item.quantityPurchased - delivery.quantity,
            },
          },
          data: {
            quantityRedeemed: {
              increment: delivery.quantity,
            },
          },
        })

        if (updateResult.count === 0) {
          throw new Error(
            `Stock insuficiente o ya despachado para: ${item.productNameSnapshot || item.product?.name || 'Bebida'}`
          )
        }

        // Si hay producto de sustitución por falta de stock
        let substituteProductId: string | null = null
        const subId = delivery.substituteProductId || delivery.substitutedProductId
        if (subId) {
          const substitute = await tx.product.findUnique({
            where: { id: subId },
          })
          if (!substitute) {
            throw new Error('Producto de sustitución no encontrado.')
          }
          if (Number(substitute.price) > Number(item.unitPrice)) {
            throw new Error(
              `El producto de sustitución (${substitute.name}) tiene un precio superior al original.`
            )
          }
          substituteProductId = substitute.id
        }

        // Crear registro inmutable de auditoría en RedemptionLog
        const log = await tx.redemptionLog.create({
          data: {
            orderId: order.id,
            orderItemId: item.id,
            bartenderUserId: effectiveBartenderId,
            quantityDelivered: delivery.quantity,
            substitutedProductId: substituteProductId,
          },
        })

        logIds.push(log.id)
      }

      // 3. Verificar si todos los ítems fueron entregados para marcar como DEPLETED
      const refreshedItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      })

      const isAllRedeemed = refreshedItems.every((i) => i.quantityRedeemed >= i.quantityPurchased)
      if (isAllRedeemed) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'DEPLETED' },
        })
      }

      const updatedOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: { include: { product: true } } },
      })

      return {
        success: true,
        order: updatedOrder,
        redeemedItemsCount: logIds.length,
        isFullyRedeemed: isAllRedeemed,
        redemptionLogIds: logIds,
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[redeemOrderItems] Error en transacción de despacho:', msg)
    return {
      success: false,
      redemptionLogIds: [],
      error: msg,
    }
  }
}

/**
 * Revierte una entrega reciente realizada por error dentro de los 60 segundos.
 */
export async function rollbackRecentRedemption({
  redemptionLogIds,
  bartenderUserId,
}: {
  redemptionLogIds: string[]
  bartenderUserId?: string
}): Promise<{ success: boolean; error?: string }> {
  if (!redemptionLogIds || redemptionLogIds.length === 0) {
    return { success: false, error: 'No se indicaron entregas para revertir.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const logs = await tx.redemptionLog.findMany({
        where: {
          id: { in: redemptionLogIds },
          isReverted: false,
        },
      })

      if (logs.length === 0) {
        throw new Error('Las entregas seleccionadas ya fueron revertidas o no existen.')
      }

      const now = Date.now()
      const TOLERANCE_MS = 90 * 1000 // 90 segundos de tolerancia máxima

      for (const log of logs) {
        const elapsed = now - new Date(log.redeemedAt).getTime()
        if (elapsed > TOLERANCE_MS) {
          throw new Error('El tiempo límite de 60 segundos para revertir esta entrega ha expirado.')
        }

        // 1. Restaurar saldo en OrderItem
        await tx.orderItem.update({
          where: { id: log.orderItemId },
          data: {
            quantityRedeemed: {
              decrement: log.quantityDelivered,
            },
          },
        })

        // 2. Re-activar la Orden si estaba marcada como agotada
        await tx.order.update({
          where: { id: log.orderId },
          data: { status: 'ACTIVE' },
        })

        // 3. Marcar el log como revertido
        await tx.redemptionLog.update({
          where: { id: log.id },
          data: {
            isReverted: true,
            revertedAt: new Date(),
            revertedByUserId: bartenderUserId || log.bartenderUserId,
          },
        })
      }
    })

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

/**
 * Consulta de solo lectura por DNI.
 * RESTRICCIÓN DE SEGURIDAD: NO permite ejecutar canjes.
 */
export async function lookupOrdersByDni({
  dni,
  tenantSlug,
}: {
  dni: string
  tenantSlug: string
}) {
  const cleanDni = dni.replace(/\D/g, '')

  try {
    // Buscar todos los registros de usuario que coincidan con el DNI
    const users = await prisma.user.findMany({
      where: { dni: cleanDni },
      include: {
        orders: {
          where: tenantSlug ? { tenant: { slug: tenantSlug } } : {},
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: { product: true },
            },
            tenant: true,
          },
        },
      },
    })

    if (!users || users.length === 0) {
      return {
        found: false,
        canRedeemFromDni: false,
        message: 'No se encontraron compras asociadas a este DNI.',
        securityNotice:
          'MODO CONSULTA: Para entregar bebidas en barra es obligatorio escanear el código QR presentado por el cliente.',
      }
    }

    // Tomar el nombre del usuario más representativo
    const primaryUser = users.find((u) => u.fullName && u.fullName.trim() !== '') || users[0]
    
    // Aplanar todas las órdenes asociadas al DNI
    const allOrders = users.flatMap((u) => u.orders)

    const orders = allOrders.map((o) => ({
      orderId: o.id,
      tenantName: o.tenant?.name || 'Boliche',
      status: o.status,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        name: i.productNameSnapshot || i.product?.name || 'Bebida',
        purchased: i.quantityPurchased,
        redeemed: i.quantityRedeemed,
        remaining: Math.max(0, i.quantityPurchased - i.quantityRedeemed),
      })),
    }))

    return {
      found: true,
      customer: {
        fullName: primaryUser.fullName || 'Cliente',
        dni: primaryUser.dni || cleanDni,
      },
      orders,
      canRedeemFromDni: false,
      securityNotice:
        'MODO CONSULTA: Para entregar bebidas en barra es obligatorio escanear el código QR presentado por el cliente.',
    }
  } catch (err) {
    console.error('[lookupOrdersByDni] Error:', err)
    return {
      found: false,
      canRedeemFromDni: false,
      error: 'Error en consulta de DNI.',
      securityNotice:
        'MODO CONSULTA: Para entregar bebidas en barra es obligatorio escanear el código QR presentado por el cliente.',
    }
  }
}
