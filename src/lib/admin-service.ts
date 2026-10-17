import { prisma } from './prisma'

export interface CategorySummary {
  category: string
  totalPurchased: number
  totalRedeemed: number
  totalRevenue: number
}

export interface ProductPerformance {
  id: string
  name: string
  category: string
  price: number
  isActive: boolean
  stockAvailable: number
  purchasedCount: number
  redeemedCount: number
  remainingCount: number
  revenue: number
}

export interface ClubNightMetrics {
  tenantName: string
  tenantSlug: string
  totalRevenue: number
  totalOrdersCount: number
  activeOrdersCount: number
  depletedOrdersCount: number
  totalDrinksPurchased: number
  totalDrinksRedeemed: number
  totalDrinksPending: number // Saldo en manos de clientes
  redemptionRatePercentage: number
  breakageCount: number
  breakageCost: number
  products: ProductPerformance[]
  categories: CategorySummary[]
  breakages: Array<{
    id: string
    productName: string
    quantity: number
    reason: string
    notes?: string | null
    costEstimate?: number | null
    createdAt: string
  }>
  recentOrders: Array<{
    id: string
    customerName: string
    customerDni: string
    status: string
    totalAmount: number
    createdAt: string
    itemsCount: number
  }>
}

/**
 * Obtiene métricas en tiempo real de la noche para el Club Admin.
 */
export async function getClubDashboardMetrics(tenantSlug: string): Promise<ClubNightMetrics | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: {
        products: {
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: true,
            items: {
              include: { product: true },
            },
          },
        },
        breakages: {
          orderBy: { createdAt: 'desc' },
          include: { product: true },
        },
      },
    })

    if (!tenant) return null

    let totalRevenue = 0
    let totalDrinksPurchased = 0
    let totalDrinksRedeemed = 0
    let activeOrdersCount = 0
    let depletedOrdersCount = 0

    // Mapa de rendimiento por producto
    const productStatsMap = new Map<
      string,
      { purchased: number; redeemed: number; revenue: number }
    >()

    // Mapa de categorías
    const categoryStatsMap = new Map<
      string,
      { purchased: number; redeemed: number; revenue: number }
    >()

    for (const p of tenant.products) {
      productStatsMap.set(p.id, { purchased: 0, redeemed: 0, revenue: 0 })
      if (!categoryStatsMap.has(p.category)) {
        categoryStatsMap.set(p.category, { purchased: 0, redeemed: 0, revenue: 0 })
      }
    }

    for (const order of tenant.orders) {
      if (order.status === 'ACTIVE' || order.status === 'DEPLETED') {
        totalRevenue += Number(order.totalAmount)

        if (order.status === 'ACTIVE') activeOrdersCount++
        if (order.status === 'DEPLETED') depletedOrdersCount++

        for (const item of order.items) {
          totalDrinksPurchased += item.quantityPurchased
          totalDrinksRedeemed += item.quantityRedeemed

          const itemRev = Number(item.unitPrice) * item.quantityPurchased

          // Estadísticas de producto
          const pStat = productStatsMap.get(item.productId)
          if (pStat) {
            pStat.purchased += item.quantityPurchased
            pStat.redeemed += item.quantityRedeemed
            pStat.revenue += itemRev
          }

          // Estadísticas de categoría
          const cat = item.product?.category || 'Tragos'
          const cStat = categoryStatsMap.get(cat)
          if (cStat) {
            cStat.purchased += item.quantityPurchased
            cStat.redeemed += item.quantityRedeemed
            cStat.revenue += itemRev
          } else {
            categoryStatsMap.set(cat, {
              purchased: item.quantityPurchased,
              redeemed: item.quantityRedeemed,
              revenue: itemRev,
            })
          }
        }
      }
    }

    const totalDrinksPending = Math.max(0, totalDrinksPurchased - totalDrinksRedeemed)
    const redemptionRatePercentage =
      totalDrinksPurchased > 0
        ? Math.round((totalDrinksRedeemed / totalDrinksPurchased) * 100)
        : 0

    const products: ProductPerformance[] = tenant.products.map((p) => {
      const stats = productStatsMap.get(p.id) || { purchased: 0, redeemed: 0, revenue: 0 }
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: Number(p.price),
        isActive: p.isActive,
        stockAvailable: p.stockAvailable,
        purchasedCount: stats.purchased,
        redeemedCount: stats.redeemed,
        remainingCount: Math.max(0, stats.purchased - stats.redeemed),
        revenue: stats.revenue,
      }
    })

    const categories: CategorySummary[] = Array.from(categoryStatsMap.entries()).map(
      ([category, stats]) => ({
        category,
        totalPurchased: stats.purchased,
        totalRedeemed: stats.redeemed,
        totalRevenue: stats.revenue,
      })
    )

    let breakageCount = 0
    let breakageCost = 0
    const breakages = tenant.breakages.map((b) => {
      breakageCount += b.quantity
      const cost = Number(b.costEstimate || Number(b.product?.price || 0) * 0.4) // Costo estimado de reposición
      breakageCost += cost * b.quantity
      return {
        id: b.id,
        productName: b.product?.name || 'Bebida',
        quantity: b.quantity,
        reason: b.reason,
        notes: b.notes,
        costEstimate: cost,
        createdAt: b.createdAt.toISOString(),
      }
    })

    const recentOrders = tenant.orders.slice(0, 10).map((o) => ({
      id: o.id,
      customerName: o.user?.fullName || 'Cliente',
      customerDni: o.user?.dni || '',
      status: o.status,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt.toISOString(),
      itemsCount: o.items.reduce((sum, it) => sum + it.quantityPurchased, 0),
    }))

    return {
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      totalRevenue,
      totalOrdersCount: tenant.orders.length,
      activeOrdersCount,
      depletedOrdersCount,
      totalDrinksPurchased,
      totalDrinksRedeemed,
      totalDrinksPending,
      redemptionRatePercentage,
      breakageCount,
      breakageCost,
      products,
      categories,
      breakages,
      recentOrders,
    }
  } catch (err) {
    console.error('[getClubDashboardMetrics] Error:', err)
    return null
  }
}

/**
 * Activa o pausa un trago en tiempo real.
 */
export async function toggleProductStatus({
  productId,
  isActive,
}: {
  productId: string
  isActive: boolean
}) {
  return prisma.product.update({
    where: { id: productId },
    data: { isActive },
  })
}

/**
 * Actualiza stock o precio de un trago.
 */
export async function updateProductDetails({
  productId,
  price,
  stockAvailable,
}: {
  productId: string
  price?: number
  stockAvailable?: number
}) {
  return prisma.product.update({
    where: { id: productId },
    data: {
      ...(price !== undefined ? { price } : {}),
      ...(stockAvailable !== undefined ? { stockAvailable } : {}),
    },
  })
}

/**
 * Registra una rotura, derrame o merma nocturna.
 */
export async function recordBreakage({
  tenantSlug,
  productId,
  quantity,
  reason,
  notes,
  costEstimate,
  bartenderUserId,
}: {
  tenantSlug: string
  productId: string
  quantity: number
  reason: string
  notes?: string
  costEstimate?: number
  bartenderUserId?: string
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  })
  if (!tenant) throw new Error('Boliche no encontrado')

  return prisma.breakageLog.create({
    data: {
      tenantId: tenant.id,
      productId,
      quantity,
      reason,
      notes: notes || null,
      costEstimate: costEstimate || null,
      loggedByUserId: bartenderUserId || null,
    },
  })
}

/**
 * Genera el reporte CSV del Cierre de Noche para exportación contable.
 */
export async function generateNightAuditCsv(tenantSlug: string): Promise<string> {
  const metrics = await getClubDashboardMetrics(tenantSlug)
  if (!metrics) throw new Error('No se pudieron obtener métricas para la exportación.')

  const now = new Date().toLocaleString('es-AR')

  let csv = `REPORTE DE CIERRE NOCTURNO - BARRA ONLINE\n`
  csv += `Boliche: ${metrics.tenantName} (${metrics.tenantSlug})\n`
  csv += `Fecha y Hora de Cierre: ${now}\n`
  csv += `Total Recaudado: $${metrics.totalRevenue}\n`
  csv += `Total Bebidas Vendidas: ${metrics.totalDrinksPurchased}\n`
  csv += `Total Bebidas Despachadas en Barra: ${metrics.totalDrinksRedeemed}\n`
  csv += `Saldo No Canjeado (Expirado 07:00 AM): ${metrics.totalDrinksPending}\n`
  csv += `Tasa de Canje: ${metrics.redemptionRatePercentage}%\n`
  csv += `Total Roturas/Mermas Registradas: ${metrics.breakageCount} unidades ($${metrics.breakageCost})\n\n`

  csv += `DETALLE POR PRODUCTO\n`
  csv += `Producto,Categoria,Precio,Estado,Vendidos,Despachados,Pendientes,Recaudacion\n`
  for (const p of metrics.products) {
    csv += `"${p.name}","${p.category}",${p.price},${p.isActive ? 'ACTIVO' : 'PAUSADO'},${p.purchasedCount},${p.redeemedCount},${p.remainingCount},${p.revenue}\n`
  }

  csv += `\nREGISTRO DE ROTURAS Y MERMAS\n`
  csv += `Fecha,Producto,Cantidad,Motivo,Notas,Costo Estimado\n`
  for (const b of metrics.breakages) {
    csv += `"${b.createdAt}","${b.productName}",${b.quantity},"${b.reason}","${b.notes || ''}",${b.costEstimate || 0}\n`
  }

  return csv
}
