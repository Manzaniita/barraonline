import { NextRequest, NextResponse } from 'next/server'
import { updateMyAccount } from '@/lib/auth-service'
import { clearSessionCookie, getSessionUser, publicSelf, setSessionCookie } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/me
 * Devuelve SOLO al usuario dueño de la cookie de sesión. Nunca acepta userId/dni por query.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req)
    if (!user) {
      return NextResponse.json({ success: false, user: null }, { status: 200 })
    }
    return NextResponse.json({ success: true, user: publicSelf(user) })
  } catch (error: any) {
    console.error('[GET /api/auth/me] Error:', error?.message)
    return NextResponse.json({ success: false, user: null }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: 'Debés iniciar sesión para editar tu cuenta.' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { fullName, email, phone, dni, currentPassword, newPassword } = body

    const updatedUser = await updateMyAccount({
      userId: sessionUser.id,
      fullName,
      email,
      phone,
      dni,
      currentPassword,
      newPassword,
    })

    const res = NextResponse.json({ success: true, user: publicSelf(updatedUser) })
    setSessionCookie(res, updatedUser)
    return res
  } catch (error: any) {
    console.error('[PUT /api/auth/me] Error:', error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error actualizando perfil.' },
      { status: 400 }
    )
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  clearSessionCookie(res)
  return res
}
