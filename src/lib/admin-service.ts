import { prisma } from './prisma'
import { getSaasPlanById } from './saas-plans'

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
  description?: string | null
  price: number
  imageUrl?: string | null
  isActive: boolean
  stockAvailable: number
  redeemDeadlineTime?: string | null
  purchasedCount: number
  redeemedCount: number
  remainingCount: number
  revenue: number
}

export interface TenantSettingsData {
  id: string
  name: string
  slug: string
  defaultExpirationHour: string
  mpSellerId?: string | null
  mpPublicKey?: string | null
  hasMpAccessToken: boolean
  hasMpWebhookSecret: boolean
  planCode: string
  planName: string
  feePercentage: number
  subscriptionPriceMonthly: number
  maxProducts: number
  maxStaff: number
  themeConfig: {
    nightclubName?: string
    tagline?: string
    searchPlaceholder?: string
    logoUrl?: string
    bannerUrl?: string
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    cardBackground?: string
    textColor?: string
  }
}

export interface ClubNightMetrics {
  tenantName: string
  tenantSlug: string
  tenantSettings: TenantSettingsData
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
 * Optimización de métricas de alto rendimiento:
 * Agregación directa en PostgreSQL sin cargar objetos masivos en RAM.
 */
export async function getDashboardMetrics(tenantId: string) {
  const [orderAggregate, totalItemsSold] = await Promise.all([
    prisma.order.aggregate({
      where: { tenantId, status: { in: ['ACTIVE', 'DEPLETED'] } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.orderItem.aggregate({
      where: { order: { tenantId, status: { in: ['ACTIVE', 'DEPLETED'] } } },
      _sum: { quantityPurchased: true },
    }),
  ])

  return {
    revenue: Number(orderAggregate._sum.totalAmount) || 0,
    totalOrders: orderAggregate._count.id || 0,
    totalDrinksSold: totalItemsSold._sum.quantityPurchased || 0,
  }
}

/**
 * Obtiene métricas en tiempo real de la noche para el Club Admin.
 * Refactorizado para usar agregaciones en PostgreSQL y paginación de órdenes recientes.
 */
export async function getClubDashboardMetrics(tenantSlug: string): Promise<ClubNightMetrics | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: {
        products: {
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        },
      },
    })

    if (!tenant) return null

    // 1. Ejecutar agregaciones directas en base de datos en paralelo
    const [
      revenueAggregate,
      totalOrdersCount,
      activeOrdersCount,
      depletedOrdersCount,
      itemGroupStats,
      recentOrdersRaw,
      breakagesRaw,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'DEPLETED'] } },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({
        where: { tenantId: tenant.id },
      }),
      prisma.order.count({
        where: { tenantId: tenant.id, status: 'ACTIVE' },
      }),
      prisma.order.count({
        where: { tenantId: tenant.id, status: 'DEPLETED' },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: { tenantId: tenant.id, status: { in: ['ACTIVE', 'DEPLETED'] } },
        },
        _sum: {
          quantityPurchased: true,
          quantityRedeemed: true,
        },
      }),
      prisma.order.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { fullName: true, dni: true } },
          items: { select: { quantityPurchased: true } },
        },
      }),
      prisma.breakageLog.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
        include: { product: true },
      }),
    ])

    const totalRevenue = Number(revenueAggregate._sum.totalAmount) || 0

    // 2. Mapear agregaciones de ítems por producto
    const productStatsMap = new Map<
      string,
      { purchased: number; redeemed: number; revenue: number }
    >()

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

    let totalDrinksPurchased = 0
    let totalDrinksRedeemed = 0

    const productPriceMap = new Map(tenant.products.map((p) => [p.id, { price: Number(p.price), category: p.category }]))

    for (const group of itemGroupStats) {
      const pInfo = productPriceMap.get(group.productId)
      const purchased = group._sum.quantityPurchased || 0
      const redeemed = group._sum.quantityRedeemed || 0
      const unitPrice = pInfo ? pInfo.price : 0
      const rev = purchased * unitPrice

      totalDrinksPurchased += purchased
      totalDrinksRedeemed += redeemed

      const pStat = productStatsMap.get(group.productId)
      if (pStat) {
        pStat.purchased = purchased
        pStat.redeemed = redeemed
        pStat.revenue = rev
      }

      const cat = pInfo ? pInfo.category : 'Tragos'
      const cStat = categoryStatsMap.get(cat)
      if (cStat) {
        cStat.purchased += purchased
        cStat.redeemed += redeemed
        cStat.revenue += rev
      } else {
        categoryStatsMap.set(cat, { purchased, redeemed, revenue: rev })
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
        description: p.description,
        price: Number(p.price),
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        stockAvailable: p.stockAvailable,
        redeemDeadlineTime: p.redeemDeadlineTime,
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
    const breakages = breakagesRaw.map((b) => {
      breakageCount += b.quantity
      const cost = Number(b.costEstimate || Number(b.product?.price || 0) * 0.4)
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

    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o.id,
      customerName: o.user?.fullName || 'Cliente',
      customerDni: o.user?.dni || '',
      status: o.status,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt.toISOString(),
      itemsCount: o.items.reduce((sum, it) => sum + it.quantityPurchased, 0),
    }))

    const rawTheme =
      tenant.themeConfig && typeof tenant.themeConfig === 'object'
        ? (tenant.themeConfig as Record<string, any>)
        : {}

    const planCode = String(rawTheme.plan || 'PRO').toUpperCase()
    const planDetails = await getSaasPlanById(planCode)

    const tenantSettings: TenantSettingsData = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      defaultExpirationHour: tenant.defaultExpirationHour || '07:00',
      mpSellerId: tenant.mpSellerId,
      mpPublicKey: tenant.mpPublicKey,
      hasMpAccessToken: Boolean(tenant.mpAccessTokenEnc && tenant.mpAccessTokenEnc.trim() !== ''),
      hasMpWebhookSecret: Boolean(tenant.mpWebhookSecret && tenant.mpWebhookSecret.trim() !== ''),
      planCode,
      planName: planDetails?.name || planCode,
      feePercentage: Number(tenant.feePercentage || 0),
      subscriptionPriceMonthly: Number(tenant.subscriptionPriceMonthly || planDetails?.monthlyPrice || 0),
      maxProducts: planDetails?.maxProducts ?? 0,
      maxStaff: planDetails?.maxStaff ?? 0,
      themeConfig: {
        nightclubName: rawTheme.nightclubName || tenant.name,
        tagline: rawTheme.tagline || '',
        searchPlaceholder: rawTheme.searchPlaceholder || '',
        logoUrl: rawTheme.logoUrl || '',
        bannerUrl: rawTheme.bannerUrl || '',
        primaryColor: rawTheme.primaryColor || '#9333ea',
        secondaryColor: rawTheme.secondaryColor || '#ec4899',
        backgroundColor: rawTheme.backgroundColor || '#0a0a0c',
        cardBackground: rawTheme.cardBackground || '#12121a',
        textColor: rawTheme.textColor || '#ffffff',
      },
    }

    return {
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      tenantSettings,
      totalRevenue,
      totalOrdersCount,
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
 * Verifica que un producto exista y pertenezca a la tienda autorizada (prevención Cross-Tenant IDOR).
 */
export async function verifyProductBelongsToTenant(
  productId: string,
  tenantSlug?: string | null
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { tenant: { select: { slug: true } } },
  })
  if (!product) {
    throw new Error('Producto no encontrado.')
  }
  if (tenantSlug && product.tenant.slug !== tenantSlug) {
    throw new Error('Acceso denegado: el producto pertenece a otra tienda.')
  }
  return product
}

/**
 * Activa o pausa un trago en tiempo real.
 */
export async function toggleProductStatus({
  productId,
  isActive,
  tenantSlug,
}: {
  productId: string
  isActive: boolean
  tenantSlug?: string | null
}) {
  await verifyProductBelongsToTenant(productId, tenantSlug)
  return prisma.product.update({
    where: { id: productId },
    data: { isActive },
  })
}

/**
 * Crea un nuevo producto en la carta del boliche (validando límites del Plan SaaS).
 */
export async function createProduct({
  tenantSlug,
  name,
  category,
  description,
  price,
  stockAvailable,
  imageUrl,
  redeemDeadlineTime,
  isActive = true,
}: {
  tenantSlug: string
  name: string
  category: string
  description?: string | null
  price: number
  stockAvailable: number
  imageUrl?: string | null
  redeemDeadlineTime?: string | null
  isActive?: boolean
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: { _count: { select: { products: true } } },
  })
  if (!tenant) {
    throw new Error('Tienda no encontrada.')
  }

  const rawTheme =
    tenant.themeConfig && typeof tenant.themeConfig === 'object'
      ? (tenant.themeConfig as Record<string, any>)
      : {}
  const planCode = String(rawTheme.plan || 'PRO').toUpperCase()
  const planDetails = await getSaasPlanById(planCode)

  if (
    planDetails &&
    planDetails.maxProducts > 0 &&
    tenant._count.products >= planDetails.maxProducts
  ) {
    throw new Error(
      `Tu tienda alcanzó el límite de ${planDetails.maxProducts} productos en carta permitido por tu Plan ${planDetails.name}. Contactá al administrador de la plataforma para ampliar tu plan.`
    )
  }

  return prisma.product.create({
    data: {
      tenantId: tenant.id,
      name: name.trim(),
      category: category.trim() || 'General',
      description: description?.trim() || null,
      price: Number(price),
      stockAvailable: Math.max(0, Number(stockAvailable) || 0),
      imageUrl: imageUrl?.trim() || null,
      redeemDeadlineTime: redeemDeadlineTime?.trim() || null,
      isActive: Boolean(isActive),
    },
  })
}

/**
 * Actualiza todos los campos editables de un producto.
 */
export async function updateProductDetails({
  productId,
  tenantSlug,
  name,
  category,
  description,
  price,
  stockAvailable,
  imageUrl,
  redeemDeadlineTime,
  isActive,
}: {
  productId: string
  tenantSlug?: string | null
  name?: string
  category?: string
  description?: string | null
  price?: number
  stockAvailable?: number
  imageUrl?: string | null
  redeemDeadlineTime?: string | null
  isActive?: boolean
}) {
  await verifyProductBelongsToTenant(productId, tenantSlug)
  return prisma.product.update({
    where: { id: productId },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(category !== undefined ? { category: category.trim() || 'General' } : {}),
      ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
      ...(price !== undefined ? { price: Number(price) } : {}),
      ...(stockAvailable !== undefined ? { stockAvailable: Math.max(0, Number(stockAvailable) || 0) } : {}),
      ...(imageUrl !== undefined ? { imageUrl: imageUrl ? imageUrl.trim() : null } : {}),
      ...(redeemDeadlineTime !== undefined
        ? { redeemDeadlineTime: redeemDeadlineTime ? redeemDeadlineTime.trim() : null }
        : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  })
}

/**
 * Elimina un producto y limpia sus referencias en cascada transaccional.
 */
export async function deleteProduct({
  productId,
  tenantSlug,
}: {
  productId: string
  tenantSlug?: string | null
}) {
  await verifyProductBelongsToTenant(productId, tenantSlug)
  return prisma.$transaction(async (tx) => {
    const orderItems = await tx.orderItem.findMany({
      where: { productId },
      select: { id: true },
    })
    const orderItemIds = orderItems.map((i) => i.id)

    if (orderItemIds.length > 0) {
      await tx.redemptionLog.deleteMany({
        where: { orderItemId: { in: orderItemIds } },
      })
    }

    await tx.redemptionLog.updateMany({
      where: { substitutedProductId: productId },
      data: { substitutedProductId: null },
    })

    await tx.orderItem.deleteMany({
      where: { productId },
    })

    await tx.breakageLog.deleteMany({
      where: { productId },
    })

    return tx.product.delete({
      where: { id: productId },
    })
  })
}

/**
 * Actualiza la configuración general, estética y credenciales de la tienda.
 */
export async function updateTenantSettings({
  tenantSlug,
  name,
  defaultExpirationHour,
  mpSellerId,
  mpPublicKey,
  mpAccessTokenEnc,
  mpWebhookSecret,
  clearMpCredentials,
  themeConfig,
}: {
  tenantSlug: string
  name?: string
  defaultExpirationHour?: string
  mpSellerId?: string | null
  mpPublicKey?: string | null
  mpAccessTokenEnc?: string | null
  mpWebhookSecret?: string | null
  clearMpCredentials?: boolean
  themeConfig?: Record<string, any>
}) {
  const existing = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  })
  if (!existing) {
    throw new Error('Tienda no encontrada.')
  }

  const prevTheme =
    existing.themeConfig && typeof existing.themeConfig === 'object'
      ? (existing.themeConfig as Record<string, any>)
      : {}

  const mergedTheme = themeConfig
    ? {
        ...prevTheme,
        ...themeConfig,
        nightclubName: themeConfig.nightclubName ?? (name ? name.trim() : prevTheme.nightclubName || existing.name),
      }
    : prevTheme

  return prisma.tenant.update({
    where: { id: existing.id },
    data: {
      ...(name !== undefined && name.trim() ? { name: name.trim() } : {}),
      ...(defaultExpirationHour !== undefined && defaultExpirationHour.trim()
        ? { defaultExpirationHour: defaultExpirationHour.trim() }
        : {}),
      ...(clearMpCredentials
        ? {
            mpSellerId: null,
            mpPublicKey: null,
            mpAccessTokenEnc: null,
            mpWebhookSecret: null,
          }
        : {
            ...(mpSellerId !== undefined ? { mpSellerId: mpSellerId ? mpSellerId.trim() : null } : {}),
            ...(mpPublicKey !== undefined ? { mpPublicKey: mpPublicKey ? mpPublicKey.trim() : null } : {}),
            ...(mpAccessTokenEnc && mpAccessTokenEnc.trim() !== ''
              ? { mpAccessTokenEnc: mpAccessTokenEnc.trim() }
              : {}),
            ...(mpWebhookSecret && mpWebhookSecret.trim() !== ''
              ? { mpWebhookSecret: mpWebhookSecret.trim() }
              : {}),
          }),
      themeConfig: mergedTheme,
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

function sanitizeCsvCell(value: unknown): string {
  const raw = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${neutralized.replace(/"/g, '""')}"`
}

/**
 * Genera el reporte CSV del Cierre de Noche para exportación contable.
 */
export async function generateNightAuditCsv(tenantSlug: string): Promise<string> {
  const metrics = await getClubDashboardMetrics(tenantSlug)
  if (!metrics) throw new Error('No se pudieron obtener métricas para la exportación.')

  const now = new Date().toLocaleString('es-AR')

  let csv = `REPORTE DE CIERRE NOCTURNO - BARRA ONLINE\n`
  csv += `Boliche: ${sanitizeCsvCell(`${metrics.tenantName} (${metrics.tenantSlug})`)}\n`
  csv += `Fecha y Hora de Cierre: ${sanitizeCsvCell(now)}\n`
  csv += `Total Recaudado: $${Number(metrics.totalRevenue)}\n`
  csv += `Total Bebidas Vendidas: ${Number(metrics.totalDrinksPurchased)}\n`
  csv += `Total Bebidas Despachadas en Barra: ${Number(metrics.totalDrinksRedeemed)}\n`
  csv += `Saldo No Canjeado (Expirado 07:00 AM): ${Number(metrics.totalDrinksPending)}\n`
  csv += `Tasa de Canje: ${Number(metrics.redemptionRatePercentage)}%\n`
  csv += `Total Roturas/Mermas Registradas: ${Number(metrics.breakageCount)} unidades ($${Number(metrics.breakageCost)})\n\n`

  csv += `DETALLE POR PRODUCTO\n`
  csv += `Producto,Categoria,Precio,Estado,Vendidos,Despachados,Pendientes,Recaudacion\n`
  for (const p of metrics.products) {
    csv += `${sanitizeCsvCell(p.name)},${sanitizeCsvCell(p.category)},${Number(p.price)},${p.isActive ? 'ACTIVO' : 'PAUSADO'},${Number(p.purchasedCount)},${Number(p.redeemedCount)},${Number(p.remainingCount)},${Number(p.revenue)}\n`
  }

  csv += `\nREGISTRO DE ROTURAS Y MERMAS\n`
  csv += `Fecha,Producto,Cantidad,Motivo,Notas,Costo Estimado\n`
  for (const b of metrics.breakages) {
    csv += `${sanitizeCsvCell(b.createdAt)},${sanitizeCsvCell(b.productName)},${Number(b.quantity)},${sanitizeCsvCell(b.reason)},${sanitizeCsvCell(b.notes || '')},${Number(b.costEstimate || 0)}\n`
  }

  return csv
}
