import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/session'
import {
  getAllSaasPlans,
  upsertSaasPlan,
  deleteSaasPlan,
} from '@/lib/saas-plans'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiRole(req, ['SUPER_ADMIN'])
    if (auth.error) return auth.error

    const [plans, tenants] = await Promise.all([
      getAllSaasPlans(),
      prisma.tenant.findMany({
        select: { id: true, themeConfig: true },
      }),
    ])

    const usageMap = new Map<string, number>()
    for (const t of tenants) {
      const cfg = (t.themeConfig as any) || {}
      const planCode = String(cfg.plan || 'PRO').toUpperCase()
      usageMap.set(planCode, (usageMap.get(planCode) || 0) + 1)
    }

    const enrichedPlans = plans.map((p) => ({
      ...p,
      tenantsCount: usageMap.get(p.id.toUpperCase()) || 0,
    }))

    return NextResponse.json({
      success: true,
      plans: enrichedPlans,
    })
  } catch (error: any) {
    console.error('[GET /api/superadmin/plans] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al obtener planes SaaS' },
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
      id,
      name,
      description,
      feePercentage,
      monthlyPrice,
      maxProducts,
      maxStaff,
      isActive,
      sortOrder,
      syncTenants = true,
    } = body

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: 'Código y nombre del plan son obligatorios.' },
        { status: 400 }
      )
    }

    const saved = await upsertSaasPlan({
      id,
      name,
      description,
      feePercentage: Number(feePercentage ?? 0),
      monthlyPrice: Number(monthlyPrice ?? 0),
      maxProducts: Number(maxProducts ?? 0),
      maxStaff: Number(maxStaff ?? 0),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      sortOrder: Number(sortOrder ?? 10),
    })

    // Si syncTenants está activo, actualizamos comisión y abono mensual de todos los boliches que tengan asignado este plan
    let syncedCount = 0
    if (syncTenants) {
      const allTenants = await prisma.tenant.findMany({
        select: { id: true, themeConfig: true },
      })
      const matchingIds = allTenants
        .filter((t) => {
          const cfg = (t.themeConfig as any) || {}
          return String(cfg.plan || 'PRO').toUpperCase() === saved.id.toUpperCase()
        })
        .map((t) => t.id)

      if (matchingIds.length > 0) {
        await prisma.tenant.updateMany({
          where: { id: { in: matchingIds } },
          data: {
            feePercentage: saved.feePercentage,
            subscriptionPriceMonthly: saved.monthlyPrice,
          },
        })
        syncedCount = matchingIds.length
      }
    }

    return NextResponse.json({
      success: true,
      plan: saved,
      syncedCount,
      message:
        syncedCount > 0
          ? `Plan "${saved.name}" guardado y aplicado a ${syncedCount} boliche(s).`
          : `Plan "${saved.name}" guardado correctamente.`,
    })
  } catch (error: any) {
    console.error('[POST /api/superadmin/plans] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error guardando plan SaaS' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  return POST(req)
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireApiRole(req, ['SUPER_ADMIN'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')?.trim().toUpperCase()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Se requiere especificar el código del plan a eliminar.' },
        { status: 400 }
      )
    }

    const allTenants = await prisma.tenant.findMany({
      select: { id: true, name: true, themeConfig: true },
    })

    const usingTenants = allTenants.filter((t) => {
      const cfg = (t.themeConfig as any) || {}
      return String(cfg.plan || 'PRO').toUpperCase() === id
    })

    if (usingTenants.length > 0) {
      const names = usingTenants.map((t) => t.name).join(', ')
      return NextResponse.json(
        {
          success: false,
          error: `No se puede eliminar el plan "${id}" porque está asignado a: ${names}. Cambiá primero el plan de esos boliches.`,
        },
        { status: 400 }
      )
    }

    await deleteSaasPlan(id)

    return NextResponse.json({
      success: true,
      message: `Plan "${id}" eliminado correctamente.`,
    })
  } catch (error: any) {
    console.error('[DELETE /api/superadmin/plans] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error eliminando plan SaaS' },
      { status: 500 }
    )
  }
}
