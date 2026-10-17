import { NextRequest, NextResponse } from 'next/server'
import { registerAccount, createSessionToken } from '@/lib/auth-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, phone, dni, fullName, password, tenantSlug } = body

    if (!fullName || !password) {
      return NextResponse.json(
        { success: false, error: 'Nombre completo y contraseña son obligatorios.' },
        { status: 400 }
      )
    }

    const user = await registerAccount({
      email,
      phone,
      dni,
      fullName,
      password,
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
    console.error('[POST /api/auth/register] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al registrar la cuenta.' },
      { status: 400 }
    )
  }
}
