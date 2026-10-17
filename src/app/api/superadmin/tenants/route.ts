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

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.isActive ? t.subscriptionStatus : 'SUSPENDED',
        plan: themeConfig.plan || 'PRO',
        brandColor: themeConfig.brandColor || '#8B5CF6',
        accentColor: themeConfig.accentColor || '#EC4899',
        feePercentage: Number(t.feePercentage),
        totalOrders: t._count.orders,
        totalProducts: t._count.products,
        totalStaff: t._count.users,
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
    const { name, slug, brandColor, accentColor, feePercentage, plan } = body

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

    // Crear boliche
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug: cleanSlug,
        feePercentage: feePercentage !== undefined ? Number(feePercentage) : 5.0,
        subscriptionStatus: 'ACTIVE',
        isActive: true,
        themeConfig: {
          brandColor: brandColor || '#8B5CF6',
          accentColor: accentColor || '#EC4899',
          plan: plan || 'PRO',
        },
        // Crear catálogo base inicial para que pueda vender de inmediato
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
