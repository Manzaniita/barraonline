import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiRole(req, ['SUPER_ADMIN'])
    if (auth.error) return auth.error
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        products: true,
        orders: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            feeAmount: true,
          },
        },
        users: {
          where: { role: 'CLUB_ADMIN' },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            dni: true,
            role: true,
            authProvider: true,
            createdAt: true,
            passwordHash: true,
          },
        },
        _count: {
          select: {
            orders: true,
            products: true,
            users: true,
          },
        },
      },
    })

    const tenantSummaries = tenants.map((t) => {
      let totalRevenue = 0
      let totalFees = 0

      for (const order of t.orders) {
        if (order.status === 'ACTIVE' || order.status === 'DEPLETED') {
          const rev = Number(order.totalAmount)
          totalRevenue += rev
          totalFees += Number(order.feeAmount) || (rev * Number(t.feePercentage)) / 100
        }
      }

      const themeConfig = (t.themeConfig as any) || {}
      const brandColor = themeConfig.brandColor || themeConfig.primaryColor || '#8B5CF6'
      const accentColor = themeConfig.accentColor || themeConfig.secondaryColor || '#EC4899'

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        domain: t.domain || '',
        status: t.isActive ? t.subscriptionStatus : 'SUSPENDED',
        subscriptionStatus: t.subscriptionStatus,
        isActive: t.isActive,
        plan: themeConfig.plan || 'PRO',
        brandColor,
        accentColor,
        nightclubName: themeConfig.nightclubName || t.name,
        tagline: themeConfig.tagline || 'Barra Rápida QR',
        defaultExpirationHour: t.defaultExpirationHour || '07:00',
        mpSellerId: t.mpSellerId || '',
        mpPublicKey: t.mpPublicKey || '',
        mpAccessTokenEnc: t.mpAccessTokenEnc || '',
        feePercentage: Number(t.feePercentage),
        totalOrders: t._count.orders,
        totalProducts: t._count.products,
        totalStaff: t._count.users,
        totalAdmins: t.users.length,
        admins: t.users.map((u) => ({
          id: u.id,
          fullName: u.fullName || 'Sin nombre',
          email: u.email,
          phone: u.phone,
          dni: u.dni,
          role: u.role,
          hasPassword: Boolean(u.passwordHash),
          createdAt: u.createdAt.toISOString(),
        })),
        totalRevenue,
        totalFees,
        createdAt: t.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      tenants: tenantSummaries,
    })
  } catch (error: any) {
    console.error('Error fetching superadmin tenants:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al obtener boliches' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole(req, ['SUPER_ADMIN'])
    if (auth.error) return auth.error

    const body = await req.json()
    const {
      name,
      slug,
      domain,
      brandColor,
      accentColor,
      nightclubName,
      tagline,
      defaultExpirationHour,
      feePercentage,
      plan,
      mpSellerId,
      mpPublicKey,
      mpAccessTokenEnc,
      seedSampleProducts = false,
    } = body

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Nombre y Slug son requeridos' },
        { status: 400 }
      )
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')

    const existing = await prisma.tenant.findUnique({
      where: { slug: cleanSlug },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: `El slug '${cleanSlug}' ya está en uso.` },
        { status: 400 }
      )
    }

    const primary = brandColor || '#8B5CF6'
    const secondary = accentColor || '#EC4899'

    // Crear boliche
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug: cleanSlug,
        domain: domain?.trim() || null,
        feePercentage: feePercentage !== undefined ? Number(feePercentage) : 5.0,
        subscriptionStatus: 'ACTIVE',
        isActive: true,
        defaultExpirationHour: defaultExpirationHour || '07:00',
        mpSellerId: mpSellerId?.trim() || null,
        mpPublicKey: mpPublicKey?.trim() || null,
        mpAccessTokenEnc: mpAccessTokenEnc?.trim() || null,
        themeConfig: {
          brandColor: primary,
          accentColor: secondary,
          primaryColor: primary,
          primaryHover: primary,
          secondaryColor: secondary,
          backgroundColor: '#0a0a0c',
          cardBackground: '#13131a',
          textColor: '#f8fafc',
          nightclubName: nightclubName || name,
          tagline: tagline || 'Barra Rápida QR',
          plan: plan || 'PRO',
        },
        ...(seedSampleProducts
          ? {
              products: {
                create: [
                  {
                    name: 'Fernet Branca con Coca',
                    category: 'Clásicos de Noche',
                    price: 4500,
                    description: 'Vaso 750ml con hielo frappé y Coca-Cola fría',
                    stockAvailable: 300,
                    isActive: true,
                  },
                  {
                    name: 'Gin Tonic Bombay Sapphire',
                    category: 'Coctelería',
                    price: 5200,
                    description: 'Gin Bombay Sapphire, tónica premium y rodaja de pepino/limón',
                    stockAvailable: 200,
                    isActive: true,
                  },
                  {
                    name: 'Cerveza Corona Extra 330ml',
                    category: 'Cervezas',
                    price: 3200,
                    description: 'Cerveza rubia con gajo de lima',
                    stockAvailable: 500,
                    isActive: true,
                  },
                  {
                    name: 'Vodka Skyy + Speed Unlimited',
                    category: 'Promos Barra',
                    price: 4800,
                    description: 'Vodka saborizado o tradicional con energizante Speed',
                    stockAvailable: 350,
                    isActive: true,
                  },
                ],
              },
            }
          : {}),
      },
      include: {
        products: true,
      },
    })

    return NextResponse.json({
      success: true,
      tenant,
    })
  } catch (error: any) {
    console.error('Error creating tenant:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error creando boliche' },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Cambio rápido de estado / plan
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireApiRole(req, ['SUPER_ADMIN'])
    if (auth.error) return auth.error

    const body = await req.json()
    const { id, status, feePercentage, plan } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID del boliche requerido' },
        { status: 400 }
      )
    }

    const currentTenant = await prisma.tenant.findUnique({
      where: { id },
    })

    if (!currentTenant) {
      return NextResponse.json(
        { success: false, error: 'Boliche no encontrado' },
        { status: 404 }
      )
    }

    const existingTheme = (currentTenant.themeConfig as any) || {}
    const updatedTheme = plan ? { ...existingTheme, plan } : existingTheme

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...(status === 'SUSPENDED'
          ? { isActive: false, subscriptionStatus: 'CANCELLED' }
          : status === 'ACTIVE'
          ? { isActive: true, subscriptionStatus: 'ACTIVE' }
          : {}),
        ...(plan ? { themeConfig: updatedTheme } : {}),
        ...(feePercentage !== undefined ? { feePercentage: Number(feePercentage) } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      tenant: updated,
    })
  } catch (error: any) {
    console.error('Error updating tenant:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error actualizando boliche' },
      { status: 500 }
    )
  }
}

/**
 * PUT: Edición completa y configurable de un boliche
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireApiRole(req, ['SUPER_ADMIN'])
    if (auth.error) return auth.error

    const body = await req.json()
    const {
      id,
      name,
      slug,
      domain,
      feePercentage,
      plan,
      brandColor,
      accentColor,
      nightclubName,
      tagline,
      defaultExpirationHour,
      subscriptionStatus,
      isActive,
      mpSellerId,
      mpPublicKey,
      mpAccessTokenEnc,
      seedSampleProducts = false,
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID del boliche requerido' },
        { status: 400 }
      )
    }

    const currentTenant = await prisma.tenant.findUnique({
      where: { id },
    })

    if (!currentTenant) {
      return NextResponse.json(
        { success: false, error: 'Boliche no encontrado' },
        { status: 404 }
      )
    }

    // Verificar slug si cambia
    let cleanSlug = currentTenant.slug
    if (slug && slug !== currentTenant.slug) {
      cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const slugConflict = await prisma.tenant.findFirst({
        where: { slug: cleanSlug, id: { not: id } },
      })
      if (slugConflict) {
        return NextResponse.json(
          { success: false, error: `El slug '${cleanSlug}' ya está asignado a otro boliche.` },
          { status: 400 }
        )
      }
    }

    const existingTheme = (currentTenant.themeConfig as any) || {}
    const primary = brandColor || existingTheme.brandColor || existingTheme.primaryColor || '#8B5CF6'
    const secondary = accentColor || existingTheme.accentColor || existingTheme.secondaryColor || '#EC4899'

    const updatedTheme = {
      ...existingTheme,
      brandColor: primary,
      accentColor: secondary,
      primaryColor: primary,
      primaryHover: primary,
      secondaryColor: secondary,
      nightclubName: nightclubName || name || existingTheme.nightclubName || currentTenant.name,
      tagline: tagline !== undefined ? tagline : existingTheme.tagline || 'Barra Rápida QR',
      plan: plan || existingTheme.plan || 'PRO',
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        name: name !== undefined ? name : currentTenant.name,
        slug: cleanSlug,
        domain: domain !== undefined ? (domain?.trim() || null) : currentTenant.domain,
        feePercentage: feePercentage !== undefined ? Number(feePercentage) : currentTenant.feePercentage,
        defaultExpirationHour: defaultExpirationHour !== undefined ? defaultExpirationHour : currentTenant.defaultExpirationHour,
        subscriptionStatus: subscriptionStatus !== undefined ? subscriptionStatus : currentTenant.subscriptionStatus,
        isActive: isActive !== undefined ? Boolean(isActive) : currentTenant.isActive,
        mpSellerId: mpSellerId !== undefined ? (mpSellerId?.trim() || null) : currentTenant.mpSellerId,
        mpPublicKey: mpPublicKey !== undefined ? (mpPublicKey?.trim() || null) : currentTenant.mpPublicKey,
        mpAccessTokenEnc: mpAccessTokenEnc !== undefined ? (mpAccessTokenEnc?.trim() || null) : currentTenant.mpAccessTokenEnc,
        themeConfig: updatedTheme,
      },
    })

    return NextResponse.json({
      success: true,
      tenant: updated,
    })
  } catch (error: any) {
    console.error('Error updating tenant in PUT:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error actualizando boliche' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Borrado definitivo de un boliche con cascada segura de datos
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireApiRole(req, ['SUPER_ADMIN'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    let id = searchParams.get('id')

    if (!id) {
      const body = await req.json().catch(() => ({}))
      id = body.id
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de boliche requerido.' },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { orders: true, products: true, users: true } } },
    })

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Boliche no encontrado.' },
        { status: 404 }
      )
    }

    // Ejecutar borrado en cascada segura dentro de una transacción
    await prisma.$transaction(async (tx) => {
      // 1. Eliminar roturas registradas
      await tx.breakageLog.deleteMany({
        where: { tenantId: id },
      })

      // 2. Localizar y eliminar órdenes, ítems y registros de redención
      const orders = await tx.order.findMany({
        where: { tenantId: id },
        select: { id: true },
      })
      const orderIds = orders.map((o) => o.id)

      if (orderIds.length > 0) {
        await tx.redemptionLog.deleteMany({
          where: { orderId: { in: orderIds } },
        })
        await tx.orderItem.deleteMany({
          where: { orderId: { in: orderIds } },
        })
        await tx.order.deleteMany({
          where: { id: { in: orderIds } },
        })
      }

      // 3. Desvincular sustituciones que apunten a productos de este boliche y luego borrar productos
      await tx.redemptionLog.updateMany({
        where: { substitutedProduct: { tenantId: id } },
        data: { substitutedProductId: null },
      })
      await tx.product.deleteMany({
        where: { tenantId: id },
      })

      // 4. Desvincular usuarios asignados a este boliche para no borrar clientes
      await tx.user.updateMany({
        where: { tenantId: id },
        data: { tenantId: null },
      })

      // 5. Eliminar el boliche
      await tx.tenant.delete({
        where: { id },
      })
    })

    return NextResponse.json({
      success: true,
      message: `Boliche "${tenant.name}" y sus datos asociados fueron eliminados correctamente.`,
    })
  } catch (error: any) {
    console.error('Error deleting tenant:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error eliminando boliche.' },
      { status: 500 }
    )
  }
}
