import { NextRequest, NextResponse } from 'next/server'
import { loginAccount, createSessionToken } from '@/lib/auth-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { identifier, password } = body

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Ingresá tu correo, teléfono o DNI y tu contraseña.' },
        { status: 400 }
      )
    }

    const user = await loginAccount({ identifier, password })
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
    console.error('[POST /api/auth/login] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Credenciales inválidas.' },
      { status: 401 }
    )
  }
}
