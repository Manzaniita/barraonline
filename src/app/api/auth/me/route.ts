import { NextRequest, NextResponse } from 'next/server'
import {
  verifySessionToken,
  getUserById,
  updateMyAccount,
  createSessionToken,
  toAuthUser,
} from '@/lib/auth-service'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('bo_session')?.value
    const { searchParams } = new URL(req.url)
    const queryUserId = searchParams.get('userId')
    const queryDni = searchParams.get('dni')

    if (token) {
      const decoded = verifySessionToken(token)
      if (decoded?.id) {
        const freshUser = await getUserById(decoded.id)
        if (freshUser) {
          return NextResponse.json({ success: true, user: freshUser })
        }
      }
    }

    if (queryUserId) {
      const freshUser = await getUserById(queryUserId)
      if (freshUser) {
        return NextResponse.json({ success: true, user: freshUser })
      }
    }

    if (queryDni) {
      const cleanDni = queryDni.replace(/\D/g, '')
      if (cleanDni.length >= 6) {
        const userByDni = await prisma.user.findFirst({
          where: { dni: cleanDni },
          include: { tenant: true },
        })
        if (userByDni) {
          return NextResponse.json({ success: true, user: toAuthUser(userByDni) })
        }
      }
    }

    return NextResponse.json({ success: false, user: null }, { status: 200 })
  } catch (error: any) {
    console.error('[GET /api/auth/me] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error verificando sesión' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, fullName, email, phone, dni, currentPassword, newPassword } = body

    const token = req.cookies.get('bo_session')?.value
    const decoded = token ? verifySessionToken(token) : null
    const targetUserId = decoded?.id || userId

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Debés iniciar sesión para editar tu cuenta.' },
        { status: 401 }
      )
    }

    const updatedUser = await updateMyAccount({
      userId: targetUserId,
      fullName,
      email,
      phone,
      dni,
      currentPassword,
      newPassword,
    })

    const newToken = createSessionToken(updatedUser)

    const res = NextResponse.json({
      success: true,
      user: updatedUser,
      token: newToken,
    })

    res.cookies.set('bo_session', newToken, {
      httpOnly: false,
      path: '/',
      maxAge: 90 * 24 * 60 * 60,
      sameSite: 'lax',
    })

    return res
  } catch (error: any) {
    console.error('[PUT /api/auth/me] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error actualizando perfil.' },
      { status: 400 }
    )
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('bo_session', '', { path: '/', maxAge: 0 })
  res.cookies.set('bo_customer', '', { path: '/', maxAge: 0 })
  return res
}
