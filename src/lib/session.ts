import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Role } from '@prisma/client'
import { AuthUser, createSessionToken, getUserById, verifySessionToken } from './auth-service'

export const SESSION_COOKIE = 'bo_session'
const SESSION_MAX_AGE = 90 * 24 * 60 * 60

export const STAFF_ROLES: Role[] = ['BARTENDER', 'CLUB_ADMIN', 'SUPER_ADMIN']
export const ADMIN_ROLES: Role[] = ['CLUB_ADMIN', 'SUPER_ADMIN']

export const DEFAULT_TENANT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG || 'demo-club'

/**
 * Lee el token de sesión (cookie httpOnly) y devuelve el usuario FRESCO desde la base de datos.
 * Nunca confía en el rol guardado en el token: siempre consulta la DB.
 */
async function userFromToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null
  const decoded = verifySessionToken(token)
  if (!decoded?.id) return null
  return getUserById(decoded.id)
}

/** Para Route Handlers. */
export async function getSessionUser(req: NextRequest): Promise<AuthUser | null> {
  return userFromToken(req.cookies.get(SESSION_COOKIE)?.value)
}

/** Para Server Components / layouts. */
export async function getServerSessionUser(): Promise<AuthUser | null> {
  const store = await cookies()
  return userFromToken(store.get(SESSION_COOKIE)?.value)
}

/**
 * Determina si un usuario tiene permiso para operar en un boliche con alguno de los roles dados.
 * SUPER_ADMIN puede todo. El resto solo dentro de su propio boliche.
 */
export function hasRoleAccess(
  user: AuthUser | null,
  allowedRoles: Role[],
  tenantSlug?: string | null
): boolean {
  if (!user) return false
  if (!allowedRoles.includes(user.role)) return false
  if (user.role === 'SUPER_ADMIN') return true
  if (tenantSlug && user.tenantSlug !== tenantSlug) return false
  return true
}

/**
 * Exige sesión + rol en una API. Devuelve el usuario o una respuesta 401/403 lista para retornar.
 */
export async function requireApiRole(
  req: NextRequest,
  allowedRoles: Role[],
  tenantSlug?: string | null
): Promise<{ user: AuthUser; error?: never } | { user?: never; error: NextResponse }> {
  const user = await getSessionUser(req)
  if (!user) {
    return {
      error: NextResponse.json({ success: false, error: 'No autenticado.' }, { status: 401 }),
    }
  }
  if (!hasRoleAccess(user, allowedRoles, tenantSlug)) {
    return {
      error: NextResponse.json({ success: false, error: 'Acceso denegado.' }, { status: 403 }),
    }
  }
  return { user }
}

export function setSessionCookie(res: NextResponse, user: AuthUser) {
  res.cookies.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  res.cookies.set('bo_customer', '', { path: '/', maxAge: 0 })
}

/** Datos mínimos del usuario que se devuelven al propio usuario logueado. */
export function publicSelf(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    dni: user.dni,
    fullName: user.fullName,
    role: user.role,
    tenantSlug: user.tenantSlug,
    authProvider: user.authProvider,
    avatarUrl: user.avatarUrl,
    hasPassword: user.hasPassword,
  }
}
