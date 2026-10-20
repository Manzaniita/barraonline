import { NextRequest, NextResponse } from 'next/server'
import { updateTenantSettings, getClubDashboardMetrics } from '@/lib/admin-service'
import { ADMIN_ROLES, requireApiRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantSlug = searchParams.get('tenantSlug') || undefined

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    const effectiveSlug = tenantSlug || auth.user.tenantSlug
    if (!effectiveSlug) {
      return NextResponse.json(
        { success: false, error: 'Se requiere especificar tenantSlug.' },
        { status: 400 }
      )
    }

    const metrics = await getClubDashboardMetrics(effectiveSlug)
    if (!metrics) {
      return NextResponse.json(
        { success: false, error: 'Tienda no encontrada.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: metrics.tenantSettings,
    })
  } catch (error: any) {
    console.error('[GET /api/admin/settings] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al obtener la configuración.' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      tenantSlug,
      name,
      defaultExpirationHour,
      mpSellerId,
      mpPublicKey,
      mpAccessTokenEnc,
      mpWebhookSecret,
      clearMpCredentials,
      themeConfig,
    } = body

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    const effectiveSlug = tenantSlug || auth.user.tenantSlug
    if (!effectiveSlug) {
      return NextResponse.json(
        { success: false, error: 'Se requiere especificar tenantSlug.' },
        { status: 400 }
      )
    }

    const updated = await updateTenantSettings({
      tenantSlug: effectiveSlug,
      name,
      defaultExpirationHour,
      mpSellerId,
      mpPublicKey,
      mpAccessTokenEnc,
      mpWebhookSecret,
      clearMpCredentials,
      themeConfig,
    })

    const { mpAccessTokenEnc: _enc, mpWebhookSecret: _sec, ...safeTenant } = updated

    return NextResponse.json({
      success: true,
      tenant: {
        ...safeTenant,
        hasMpAccessToken: Boolean(updated.mpAccessTokenEnc),
        hasMpWebhookSecret: Boolean(updated.mpWebhookSecret),
      },
      message: 'Configuración de la tienda actualizada correctamente.',
    })
  } catch (error: any) {
    console.error('[PUT /api/admin/settings] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al guardar la configuración.' },
      { status: 500 }
    )
  }
}
