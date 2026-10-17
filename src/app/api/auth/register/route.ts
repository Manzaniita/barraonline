import { NextRequest, NextResponse } from 'next/server'
import { registerAccount } from '@/lib/auth-service'
import { publicSelf, setSessionCookie } from '@/lib/session'

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

    const res = NextResponse.json({ success: true, user: publicSelf(user) })
    setSessionCookie(res, user)
    return res
  } catch (error: any) {
    console.error('[POST /api/auth/register] Error:', error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al registrar la cuenta.' },
      { status: 400 }
    )
  }
}
