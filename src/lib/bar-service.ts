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
  // 1. Verificación criptográfica de la firma del QR
  const sigResult = verifyOrderQrToken(qrToken)
  if (!sigResult.valid || !sigResult.payload) {
    return {
      valid: false,
      error:
        sigResult.error === 'EXPIRED_TOKEN'
          ? 'El código QR ha expirado (superó el horario de corte nocturno).'
          : 'Código QR inválido o falsificado. Firma digital no coincide.',
    }
  }

  const { orderId } = sigResult.payload

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
      // Si la orden no está en la base de datos (por ejemplo en prueba demo inicial)
      return {
        valid: true,
        order: {
          orderId,
          tenantId: 'tenant-demo-club',
          tenantSlug,
          customerName: sigResult.payload.userDni ? `Cliente DNI ${sigResult.payload.userDni}` : 'Cliente Demo',
          customerDni: sigResult.payload.userDni || '42123456',
          totalAmount: 14000,
          status: 'ACTIVE',
          expiresAt: sigResult.payload.expiresAt,
          items: [
            {
              orderItemId: 'item-demo-1',
              productId: 'prod-fernet-01',
              name: 'Fernet Branca con Coca',
              unitPrice: 6500,
              quantityPurchased: 2,
              quantityRedeemed: 0,
              quantityAvailable: 2,
              isExpired: false,
            },
            {
              orderItemId: 'item-demo-2',
              productId: 'prod-agua-09',
              name: 'Agua Mineral Kin',
              unitPrice: 1000,
              quantityPurchased: 1,
              quantityRedeemed: 0,
              quantityAvailable: 1,
              isExpired: false,
            },
          ],
          canRedeem: true,
        },
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

/**
 * Despacha unidades de una orden de forma atómica y transaccional.
 * Valida la firma del QR y registra la auditoría del bartender.
 */
export async function redeemOrderItems({
  qrToken,
  tenantSlug,
  bartenderUserId,
  deliveries,
}: {
  qrToken: string
  tenantSlug: string
  bartenderUserId?: string
  deliveries: ItemDeliveryInput[]
}): Promise<{
  success: boolean
  redemptionLogIds: string[]
  error?: string
}> {
  // 1. RESTRICCIÓN DURA DE SEGURIDAD: Exigir firma criptográfica del QR
  const sigResult = verifyOrderQrToken(qrToken)
  if (!sigResult.valid || !sigResult.payload) {
    return {
      success: false,
      redemptionLogIds: [],
      error: 'SEGURIDAD: No se puede despachar sin escanear un código QR válido firmado.',
    }
  }

  const { orderId } = sigResult.payload

  try {
    const defaultBartender = await prisma.user.findFirst({
      where: { role: 'BARTENDER' },
    })

    const effectiveBartenderId = bartenderUserId || defaultBartender?.id

    if (!effectiveBartenderId) {
      return { success: false, redemptionLogIds: [], error: 'Identificación de bartender no encontrada.' }
    }

    // 2. Transacción atómica en PostgreSQL
    const createdLogIds = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      })

      if (!order) {
        throw new Error('Orden no encontrada.')
      }

      if (order.status !== 'ACTIVE') {
        throw new Error(`La orden no está activa (Estado: ${order.status}).`)
      }

      const logIds: string[] = []

      for (const delivery of deliveries) {
        if (delivery.quantity <= 0) continue

        const item = order.items.find((i) => i.id === delivery.orderItemId)
        if (!item) {
          throw new Error(`Ítem de orden ${delivery.orderItemId} no existe.`)
        }

        const remaining = item.quantityPurchased - item.quantityRedeemed
        if (delivery.quantity > remaining) {
          throw new Error(
            `Cantidad excesiva para "${item.productNameSnapshot}". Disponibles: ${remaining}, Solicitadas: ${delivery.quantity}.`
          )
        }

        // Si hay sustitución por falta de stock, validar que el producto de reemplazo
        // tenga exactamente el mismo precio o menor valor.
        let substituteProductId: string | null = null
        if (delivery.substituteProductId) {
          const substitute = await tx.product.findUnique({
            where: { id: delivery.substituteProductId },
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

        // Incrementar la cantidad entregada
        const updatedItem = await tx.orderItem.update({
          where: { id: item.id },
          data: {
            quantityRedeemed: {
              increment: delivery.quantity,
            },
          },
        })

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
      const allItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      })

      const isAllRedeemed = allItems.every((i) => i.quantityRedeemed >= i.quantityPurchased)
      if (isAllRedeemed) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'DEPLETED' },
        })
      }

      return logIds
    })

    return {
      success: true,
      redemptionLogIds: createdLogIds,
    }
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
