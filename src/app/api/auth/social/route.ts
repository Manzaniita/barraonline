import { NextRequest, NextResponse } from 'next/server'
import { socialLoginAccount, createSessionToken } from '@/lib/auth-service'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/social
 * Devuelve las cuentas disponibles para mostrar en el selector rápido de cuentas del celular.
 */
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        email: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        email: true,
        fullName: true,
        dni: true,
        phone: true,
        role: true,
        avatarUrl: true,
        authProvider: true,
      },
    })

    return NextResponse.json({
      success: true,
      accounts: users.filter((u) => Boolean(u.email)),
    })
  } catch (error: any) {
    return NextResponse.json({ success: true, accounts: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, email, fullName, providerId, avatarUrl, dni, phone, tenantSlug } = body

    if (!provider || (provider !== 'google' && provider !== 'apple')) {
      return NextResponse.json(
        { success: false, error: 'Proveedor de autenticación no válido.' },
        { status: 400 }
      )
    }

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Seleccioná o ingresá un correo para continuar.' },
        { status: 400 }
      )
    }

    const user = await socialLoginAccount({
      provider,
      email,
      fullName,
      providerId,
      avatarUrl,
      dni,
      phone,
      tenantSlug,
    })

    const token = createSessionToken(user)

    const res = NextResponse.json({
      success: true,
      user,
      token,
    })

    res.cookies.set('bo_session', token, {
      httpOnly: false,
      path: '/',
      maxAge: 90 * 24 * 60 * 60,
      sameSite: 'lax',
    })

    return res
  } catch (error: any) {
    console.error('[POST /api/auth/social] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al iniciar sesión con proveedor social.' },
      { status: 400 }
    )
  }
}
