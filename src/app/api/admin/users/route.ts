import { NextRequest, NextResponse } from 'next/server'
import {
  listUsersForAdmin,
  updateUserRoleFromAdmin,
  registerAccount,
  getUserById,
} from '@/lib/auth-service'
import { ADMIN_ROLES, requireApiRole } from '@/lib/session'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantSlug = searchParams.get('tenantSlug') || undefined
    const search = searchParams.get('search') || undefined

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    const isSuper = auth.user.role === 'SUPER_ADMIN'
    const effectiveTenant = isSuper ? tenantSlug : auth.user.tenantSlug || tenantSlug

    const users = await listUsersForAdmin({
      tenantSlug: effectiveTenant,
      search,
      scopeToTenant: !isSuper,
    })

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

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

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

    const isSuper = auth.user.role === 'SUPER_ADMIN'
    if (!isSuper) {
      if (role === 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Solo un SuperAdmin puede asignar el rol SUPER_ADMIN.' },
          { status: 403 }
        )
      }
      const targetUser = await getUserById(userId)
      if (targetUser?.role === 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'No tenés permisos para modificar a un SuperAdmin.' },
          { status: 403 }
        )
      }
    }

    const effectiveTenant = isSuper ? tenantSlug : auth.user.tenantSlug || tenantSlug

    const updated = await updateUserRoleFromAdmin({
      userId,
      role,
      tenantSlug: effectiveTenant,
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

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    if (!fullName || !password) {
      return NextResponse.json(
        { success: false, error: 'Nombre completo y contraseña son obligatorios.' },
        { status: 400 }
      )
    }

    const isSuper = auth.user.role === 'SUPER_ADMIN'
    if (!isSuper && role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Solo un SuperAdmin puede crear cuentas SUPER_ADMIN.' },
        { status: 403 }
      )
    }

    const effectiveTenant = isSuper ? tenantSlug : auth.user.tenantSlug || tenantSlug

    const createdUser = await registerAccount({
      fullName,
      email,
      phone,
      dni,
      password,
      tenantSlug: effectiveTenant,
    })

    if (role && role !== 'CUSTOMER') {
      const withRole = await updateUserRoleFromAdmin({
        userId: createdUser.id,
        role: role as Role,
        tenantSlug: effectiveTenant,
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
