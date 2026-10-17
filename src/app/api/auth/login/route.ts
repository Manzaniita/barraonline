import { NextRequest, NextResponse } from 'next/server'
import { loginAccount } from '@/lib/auth-service'
import { publicSelf, setSessionCookie } from '@/lib/session'

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

    const res = NextResponse.json({ success: true, user: publicSelf(user) })
    setSessionCookie(res, user)
    return res
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Datos de acceso incorrectos.' },
      { status: 401 }
    )
  }
}
