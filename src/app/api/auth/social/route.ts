import { NextRequest, NextResponse } from 'next/server'
import { socialLoginAccount, createSessionToken } from '@/lib/auth-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, email, fullName, providerId, dni, phone, tenantSlug } = body

    if (!provider || (provider !== 'google' && provider !== 'apple')) {
      return NextResponse.json(
        { success: false, error: 'Proveedor de autenticación no válido.' },
        { status: 400 }
      )
    }

    if (!email || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Correo y nombre son requeridos para vincular la cuenta.' },
        { status: 400 }
      )
    }

    const user = await socialLoginAccount({
      provider,
      email,
      fullName,
      providerId,
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
