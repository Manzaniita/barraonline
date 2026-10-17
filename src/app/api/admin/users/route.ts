import { NextRequest, NextResponse } from 'next/server'
import {
  listUsersForAdmin,
  updateUserRoleFromAdmin,
  registerAccount,
} from '@/lib/auth-service'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantSlug = searchParams.get('tenantSlug') || undefined
    const search = searchParams.get('search') || undefined

    const users = await listUsersForAdmin({ tenantSlug, search })

    return NextResponse.json({
      success: true,
      users,
    })
  } catch (error: any) {
    console.error('[GET /api/admin/users] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al obtener lista de usuarios.' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, role, tenantSlug } = body

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: 'userId y role son obligatorios.' },
        { status: 400 }
      )
    }

    const validRoles: Role[] = ['CUSTOMER', 'BARTENDER', 'CLUB_ADMIN', 'SUPER_ADMIN']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Rol no válido.' },
        { status: 400 }
      )
    }

    const updated = await updateUserRoleFromAdmin({
      userId,
      role,
      tenantSlug,
    })

    return NextResponse.json({
      success: true,
      user: updated,
    })
  } catch (error: any) {
    console.error('[PATCH /api/admin/users] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al actualizar el rol del usuario.' },
      { status: 400 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fullName, email, phone, dni, password, role, tenantSlug } = body

    if (!fullName || !password) {
      return NextResponse.json(
        { success: false, error: 'Nombre completo y contraseña son obligatorios.' },
        { status: 400 }
      )
    }

    const createdUser = await registerAccount({
      fullName,
      email,
      phone,
      dni,
      password,
      tenantSlug,
    })

    if (role && role !== 'CUSTOMER') {
      const withRole = await updateUserRoleFromAdmin({
        userId: createdUser.id,
        role: role as Role,
        tenantSlug,
      })
      return NextResponse.json({ success: true, user: withRole })
    }

    return NextResponse.json({
      success: true,
      user: createdUser,
    })
  } catch (error: any) {
    console.error('[POST /api/admin/users] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al crear el usuario.' },
      { status: 400 }
    )
  }
}
