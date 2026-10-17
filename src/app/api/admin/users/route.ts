import { NextRequest, NextResponse } from 'next/server'
import {
  listUsersForAdmin,
  updateUserRoleFromAdmin,
  updateUserFromAdmin,
  deleteUserFromAdmin,
  registerAccount,
  getUserById,
} from '@/lib/auth-service'
import { ADMIN_ROLES, requireApiRole } from '@/lib/session'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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
      if (role === 'SUPER_ADMIN' || role === 'CLUB_ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: 'No tenés permisos para otorgar rango Administrador. Solo SuperAdmin puede designar administradores.',
          },
          { status: 403 }
        )
      }
      const targetUser = await getUserById(userId)
      if (targetUser?.role === 'SUPER_ADMIN' || targetUser?.role === 'CLUB_ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: 'No podés modificar los permisos de un Administrador ni quitárselos.',
          },
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
    const { fullName, email, phone, dni, password, role, tenantSlug, tenantId } = body

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    if (!fullName || !password) {
      return NextResponse.json(
        { success: false, error: 'Nombre completo y contraseña son obligatorios.' },
        { status: 400 }
      )
    }

    const isSuper = auth.user.role === 'SUPER_ADMIN'
    if (!isSuper) {
      if (role === 'SUPER_ADMIN' || role === 'CLUB_ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: 'No tenés permisos para crear cuentas de Administrador. Solo SuperAdmin puede designar administradores.',
          },
          { status: 403 }
        )
      }
    }

    let effectiveTenant = isSuper ? tenantSlug : auth.user.tenantSlug || tenantSlug
    if (isSuper && tenantId && !effectiveTenant) {
      const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } })
      if (t) effectiveTenant = t.slug
    }

    const createdUser = await registerAccount({
      fullName,
      email,
      phone,
      dni,
      password,
      tenantSlug: effectiveTenant,
    })

    // Si se especificó rol o tenantId diferente
    if ((role && role !== 'CUSTOMER') || tenantId !== undefined) {
      const withRole = await updateUserFromAdmin({
        userId: createdUser.id,
        role: role as Role,
        tenantId: isSuper ? tenantId : undefined,
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

/**
 * PUT: Edición completa de un usuario desde Admin / SuperAdmin
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, fullName, email, phone, dni, role, tenantId, tenantSlug, newPassword } = body

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido.' },
        { status: 400 }
      )
    }

    const isSuper = auth.user.role === 'SUPER_ADMIN'
    const targetUser = await getUserById(userId)

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado.' },
        { status: 404 }
      )
    }

    if (!isSuper) {
      if (role === 'SUPER_ADMIN' || role === 'CLUB_ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: 'No tenés permisos para otorgar rango de Administrador.',
          },
          { status: 403 }
        )
      }
      if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'CLUB_ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: 'No podés modificar a un Administrador ni cambiar sus credenciales. Solo SuperAdmin tiene este permiso.',
          },
          { status: 403 }
        )
      }
    }

    const updated = await updateUserFromAdmin({
      userId,
      fullName,
      email,
      phone,
      dni,
      role: role as Role,
      tenantId: isSuper ? tenantId : undefined,
      tenantSlug: isSuper ? tenantSlug : auth.user.tenantSlug || tenantSlug,
      newPassword,
    })

    return NextResponse.json({
      success: true,
      user: updated,
    })
  } catch (error: any) {
    console.error('[PUT /api/admin/users] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error actualizando usuario.' },
      { status: 400 }
    )
  }
}

/**
 * DELETE: Eliminación de usuario desde Admin / SuperAdmin
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let userId = searchParams.get('userId')
    let tenantSlug = searchParams.get('tenantSlug') || undefined

    if (!userId) {
      const body = await req.json().catch(() => ({}))
      userId = body.userId
      if (!tenantSlug) tenantSlug = body.tenantSlug
    }

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es obligatorio.' },
        { status: 400 }
      )
    }

    const isSuper = auth.user.role === 'SUPER_ADMIN'
    const targetUser = await getUserById(userId)

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado.' },
        { status: 404 }
      )
    }

    if (!isSuper) {
      if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'CLUB_ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: 'No tenés permisos para eliminar a un Administrador. Solo SuperAdmin puede gestionar administradores.',
          },
          { status: 403 }
        )
      }
    }

    await deleteUserFromAdmin({
      userId,
      requestingUserId: auth.user.id,
    })

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado exitosamente.',
    })
  } catch (error: any) {
    console.error('[DELETE /api/admin/users] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error eliminando usuario.' },
      { status: 400 }
    )
  }
}
