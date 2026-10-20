import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_ROLES, requireApiRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { tenantSlug, accessToken } = body

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    let tokenToTest = typeof accessToken === 'string' ? accessToken.trim() : ''

    if (!tokenToTest && tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { mpAccessTokenEnc: true },
      })
      tokenToTest = tenant?.mpAccessTokenEnc?.trim() || ''
    }

    if (!tokenToTest) {
      return NextResponse.json(
        {
          success: false,
          error: 'No hay ningún Access Token de Mercado Pago ingresado ni guardado para verificar.',
        },
        { status: 400 }
      )
    }

    const isTestToken = tokenToTest.startsWith('TEST-')
    const isProdToken = tokenToTest.startsWith('APP_USR-')

    const mpRes = await fetch('https://api.mercadopago.com/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenToTest}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!mpRes.ok) {
      const errData = await mpRes.json().catch(() => ({}))
      return NextResponse.json(
        {
          success: false,
          error:
            errData?.message ||
            'El Access Token fue rechazado por Mercado Pago. Verificá que sea un token válido de Producción (APP_USR-...) o Prueba (TEST-...).',
        },
        { status: 400 }
      )
    }

    const mpUser = await mpRes.json()

    return NextResponse.json({
      success: true,
      account: {
        sellerId: String(mpUser.id || ''),
        nickname: mpUser.nickname || '',
        email: mpUser.email || '',
        firstName: mpUser.first_name || '',
        lastName: mpUser.last_name || '',
        siteId: mpUser.site_id || 'MLA',
        mode: isTestToken ? 'SANDBOX' : isProdToken ? 'PRODUCTION' : 'CUSTOM',
      },
      message: `Conexión exitosa con Mercado Pago (${
        isTestToken ? 'Modo Sandbox / Prueba' : 'Modo Producción Real'
      }): cuenta ${mpUser.nickname || mpUser.email || mpUser.id}`,
    })
  } catch (error: any) {
    console.error('[POST /api/admin/settings/verify-mp] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Error al verificar credenciales con Mercado Pago.',
      },
      { status: 500 }
    )
  }
}
