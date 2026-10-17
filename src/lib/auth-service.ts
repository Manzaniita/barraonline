import crypto from 'crypto'
import { prisma } from './prisma'
import { Role } from '@prisma/client'

export interface AuthUser {
  id: string
  email: string | null
  phone: string | null
  dni: string | null
  fullName: string | null
  role: Role
  tenantId: string | null
  tenantSlug?: string | null
  authProvider: string | null
  avatarUrl: string | null
  hasPassword: boolean
}

const AUTH_SECRET =
  process.env.QR_SIGNING_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'barra-online-fallback-production-hmac-secret-key-2026-v1'

/**
 * Hashea una contraseña usando scrypt nativo de Node.js (sin dependencias externas pesadas).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derivedKey}`
}

/**
 * Verifica una contraseña contra el hash guardado.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':')
    if (!salt || !key) return false
    const keyBuffer = Buffer.from(key, 'hex')
    const derivedKey = crypto.scryptSync(password, salt, 64)
    return crypto.timingSafeEqual(keyBuffer, derivedKey)
  } catch {
    return false
  }
}

/**
 * Crea un token de sesión firmado con HMAC-SHA256 válido por 90 días.
 */
export function createSessionToken(user: AuthUser): string {
  // Solo el ID: el resto de los datos (incluido el rol) se lee SIEMPRE fresco desde la DB.
  const payload = {
    id: user.id,
    exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 días
  }
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(base64Payload)
    .digest('base64url')
  return `${base64Payload}.${signature}`
}

/**
 * Verifica un token de sesión y devuelve los datos del usuario si es válido.
 */
export function verifySessionToken(token: string): AuthUser | null {
  try {
    const [base64Payload, signature] = token.split('.')
    if (!base64Payload || !signature) return null

    const expectedSig = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(base64Payload)
      .digest('base64url')

    const a = Buffer.from(signature)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8'))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return {
      id: payload.id,
      email: payload.email || null,
      phone: payload.phone || null,
      dni: payload.dni || null,
      fullName: payload.fullName || null,
      role: payload.role || 'CUSTOMER',
      tenantId: payload.tenantId || null,
      tenantSlug: payload.tenantSlug || null,
      authProvider: payload.authProvider || 'credentials',
      avatarUrl: payload.avatarUrl || null,
      hasPassword: Boolean(payload.hasPassword),
    }
  } catch {
    return null
  }
}

/**
 * Convierte un registro User de Prisma en AuthUser limpio.
 */
export function toAuthUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email || null,
    phone: user.phone || null,
    dni: user.dni || null,
    fullName: user.fullName || null,
    role: user.role,
    tenantId: user.tenantId || null,
    tenantSlug: user.tenant?.slug || null,
    authProvider: user.authProvider || 'credentials',
    avatarUrl: user.avatarUrl || null,
    hasPassword: Boolean(user.passwordHash),
  }
}

/**
 * Obtiene el usuario actualizado desde la base de datos por ID.
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  })
  if (!user) return null
  return toAuthUser(user)
}

/**
 * Registra una cuenta nueva o actualiza un cliente existente sin contraseña.
 */
export async function registerAccount({
  email,
  phone,
  dni,
  fullName,
  password,
  tenantSlug,
}: {
  email?: string
  phone?: string
  dni?: string
  fullName: string
  password: string
  tenantSlug?: string
}): Promise<AuthUser> {
  const cleanEmail = email?.trim().toLowerCase() || null
  const cleanPhone = phone?.replace(/\D/g, '') || null
  const cleanDni = dni?.replace(/\D/g, '') || null

  if (!cleanEmail && !cleanPhone && !cleanDni) {
    throw new Error('Debés ingresar un correo electrónico, teléfono o DNI.')
  }

  if (password.length < 4) {
    throw new Error('La contraseña debe tener al menos 4 caracteres.')
  }

  let tenantId: string | null = null
  if (tenantSlug) {
    const t = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
    if (t) tenantId = t.id
  }

  // Buscar si ya existe un usuario con ese email, teléfono o DNI
  const orConditions: any[] = []
  if (cleanEmail) orConditions.push({ email: cleanEmail })
  if (cleanPhone) orConditions.push({ phone: cleanPhone })
  if (cleanDni) orConditions.push({ dni: cleanDni })

  const existing = await prisma.user.findFirst({
    where: { OR: orConditions },
    include: { tenant: true },
  })

  const passwordHash = hashPassword(password)

  if (existing) {
    // Si ya tenía contraseña configurada y coincide email/teléfono, avisar que ya existe
    if (existing.passwordHash) {
      throw new Error('Ya existe una cuenta registrada con esos datos. Por favor iniciá sesión.')
    }

    // Nunca permitir "reclamar" con una clave una cuenta de Google/Apple, con email, o de personal:
    // sería un robo de cuenta. Esas cuentas solo entran con su proveedor.
    const isSocial = existing.authProvider === 'google' || existing.authProvider === 'apple'
    if (isSocial || existing.email || existing.role !== 'CUSTOMER') {
      throw new Error(
        'Ya existe una cuenta con esos datos. Iniciá sesión con el método que usaste al crearla (Google, Apple o tu clave).'
      )
    }

    // Si era un cliente invitado (solo tenía DNI/teléfono por una compra previa), activamos su cuenta con clave
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: cleanEmail || existing.email,
        phone: cleanPhone || existing.phone,
        dni: cleanDni || existing.dni,
        fullName: fullName.trim() || existing.fullName,
        passwordHash,
        authProvider: cleanEmail ? 'email' : 'phone',
      },
      include: { tenant: true },
    })

    return toAuthUser(updated)
  }

  // Crear usuario nuevo
  const created = await prisma.user.create({
    data: {
      email: cleanEmail,
      phone: cleanPhone,
      dni: cleanDni,
      fullName: fullName.trim(),
      passwordHash,
      authProvider: cleanEmail ? 'email' : 'phone',
      tenantId,
      role: 'CUSTOMER',
    },
    include: { tenant: true },
  })

  return toAuthUser(created)
}

/**
 * Inicia sesión con correo, teléfono o DNI + contraseña.
 */
export async function loginAccount({
  identifier,
  password,
}: {
  identifier: string
  password: string
}): Promise<AuthUser> {
  const cleanId = identifier.trim().toLowerCase()
  const digitsOnly = identifier.replace(/\D/g, '')

  const orConditions: any[] = [{ email: cleanId }]
  if (digitsOnly.length >= 6) {
    orConditions.push({ phone: digitsOnly })
    orConditions.push({ dni: digitsOnly })
  }

  const candidates = await prisma.user.findMany({
    where: { OR: orConditions, passwordHash: { not: null } },
    include: { tenant: true },
    take: 5,
  })

  // Mensaje genérico: nunca revelar si una cuenta existe o no.
  const match = candidates.find((u) => u.passwordHash && verifyPassword(password, u.passwordHash))
  if (!match) {
    throw new Error('Datos de acceso incorrectos.')
  }

  return toAuthUser(match)
}

/**
 * Inicia sesión o registra con Google / Apple.
 * SOLO debe llamarse con una identidad ya VERIFICADA del lado del servidor (id_token del proveedor).
 * Se identifica al usuario por el `sub` del proveedor; si no existe, se vincula por email verificado
 * o se crea una cuenta nueva de cliente.
 */
export async function socialLoginAccount({
  provider,
  subject,
  email,
  emailVerified,
  fullName,
  avatarUrl,
  tenantSlug,
}: {
  provider: 'google' | 'apple'
  subject: string
  email?: string | null
  emailVerified: boolean
  fullName?: string | null
  avatarUrl?: string | null
  tenantSlug?: string | null
}): Promise<AuthUser> {
  if (!subject) throw new Error('Identidad del proveedor inválida.')

  const providerKey = `${provider}:${subject}`
  const cleanEmail = email?.trim().toLowerCase() || null

  // 1) Usuario ya vinculado a esta cuenta de Google/Apple
  const linked = await prisma.user.findUnique({
    where: { authProviderId: providerKey },
    include: { tenant: true },
  })
  if (linked) {
    const updated = await prisma.user.update({
      where: { id: linked.id },
      data: {
        email: linked.email || cleanEmail,
        fullName: linked.fullName || fullName?.trim() || undefined,
        avatarUrl: avatarUrl || linked.avatarUrl,
      },
      include: { tenant: true },
    })
    return toAuthUser(updated)
  }

  // 2) Vincular a una cuenta existente con el mismo email (solo si el proveedor lo verificó)
  if (cleanEmail && emailVerified) {
    const byEmail = await prisma.user.findFirst({
      where: { email: cleanEmail },
      orderBy: { createdAt: 'asc' },
      include: { tenant: true },
    })
    if (byEmail) {
      const hasRealProviderLink = Boolean(byEmail.authProviderId && byEmail.authProviderId.includes(':'))
      const updated = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          fullName: byEmail.fullName || fullName?.trim() || undefined,
          avatarUrl: avatarUrl || byEmail.avatarUrl,
          // Reemplaza vínculos viejos/falsos (ej: "google-mail@x.com") por el sub real del proveedor
          ...(hasRealProviderLink ? {} : { authProviderId: providerKey, authProvider: provider }),
        },
        include: { tenant: true },
      })
      return toAuthUser(updated)
    }
  }

  // 3) Cuenta nueva
  let tenantId: string | null = null
  if (tenantSlug) {
    const t = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
    if (t) tenantId = t.id
  }

  const derivedName =
    fullName?.trim() ||
    (cleanEmail
      ? cleanEmail
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
      : 'Usuario')

  const created = await prisma.user.create({
    data: {
      email: emailVerified ? cleanEmail : null,
      fullName: derivedName,
      avatarUrl: avatarUrl || null,
      authProvider: provider,
      authProviderId: providerKey,
      tenantId,
      role: 'CUSTOMER',
    },
    include: { tenant: true },
  })

  return toAuthUser(created)
}

/**
 * Actualiza datos personales y/o contraseña desde el panel "Mi Cuenta".
 */
export async function updateMyAccount({
  userId,
  fullName,
  email,
  phone,
  dni,
  currentPassword,
  newPassword,
}: {
  userId: string
  fullName?: string
  email?: string
  phone?: string
  dni?: string
  currentPassword?: string
  newPassword?: string
}): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  })

  if (!user) {
    throw new Error('Usuario no encontrado.')
  }

  const updateData: any = {}

  if (fullName !== undefined && fullName.trim()) {
    updateData.fullName = fullName.trim()
  }
  if (email !== undefined) {
    const cleanEmail = email.trim().toLowerCase()
    if (cleanEmail && cleanEmail !== user.email) {
      const emailTaken = await prisma.user.findFirst({
        where: { email: cleanEmail, id: { not: userId } },
      })
      if (emailTaken) {
        throw new Error('Ese correo electrónico ya está en uso por otra cuenta.')
      }
      updateData.email = cleanEmail
    } else if (!cleanEmail) {
      updateData.email = null
    }
  }
  if (phone !== undefined) {
    updateData.phone = phone.replace(/\D/g, '') || null
  }
  if (dni !== undefined) {
    const cleanDni = dni.replace(/\D/g, '')
    if (cleanDni && cleanDni !== user.dni) {
      const dniTaken = await prisma.user.findFirst({
        where: { dni: cleanDni, id: { not: userId } },
      })
      if (dniTaken) {
        throw new Error('Ese DNI ya está vinculado a otro usuario.')
      }
      updateData.dni = cleanDni
    }
  }

  // Cambio o creación de contraseña
  if (newPassword && newPassword.trim().length > 0) {
    if (newPassword.length < 4) {
      throw new Error('La nueva contraseña debe tener al menos 4 caracteres.')
    }
    if (user.passwordHash) {
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
        throw new Error('Para cambiar la contraseña ingresá tu contraseña actual correcta.')
      }
    }
    updateData.passwordHash = hashPassword(newPassword)
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: { tenant: true },
  })

  return toAuthUser(updated)
}

/**
 * Lista todos los usuarios para el panel de administración (asignación de roles).
 */
export async function listUsersForAdmin({
  tenantSlug,
  search,
  scopeToTenant = true,
}: {
  tenantSlug?: string
  search?: string
  /** false solo para SUPER_ADMIN: ve todos los usuarios de la plataforma */
  scopeToTenant?: boolean
}) {
  const conditions: any[] = []
  const q = search?.trim() || ''

  if (q) {
    conditions.push({
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { dni: { contains: q } },
        { phone: { contains: q } },
      ],
    })
  }

  if (scopeToTenant) {
    if (!tenantSlug) return []
    const exactMatch: any[] = []
    if (q.includes('@')) exactMatch.push({ email: q.toLowerCase() })
    const digits = q.replace(/\D/g, '')
    if (digits.length >= 7) exactMatch.push({ dni: digits })
    conditions.push({
      OR: [{ tenant: { slug: tenantSlug } }, ...exactMatch],
    })
    // Un admin de boliche nunca ve a los superadmins
    conditions.push({ role: { not: 'SUPER_ADMIN' } })
  }

  const whereClause: any = conditions.length ? { AND: conditions } : {}

  const users = await prisma.user.findMany({
    where: whereClause,
    orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      _count: { select: { orders: true, redemptions: true } },
    },
    take: 100,
  })

  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName || 'Sin nombre',
    email: u.email,
    phone: u.phone,
    dni: u.dni,
    role: u.role,
    authProvider: u.authProvider || 'credentials',
    hasPassword: Boolean(u.passwordHash),
    tenantId: u.tenantId,
    tenantName: u.tenant?.name || null,
    tenantSlug: u.tenant?.slug || null,
    ordersCount: u._count.orders,
    redemptionsCount: u._count.redemptions,
    createdAt: u.createdAt.toISOString(),
  }))
}

/**
 * Asigna rol (CUSTOMER, BARTENDER, CLUB_ADMIN, SUPER_ADMIN) desde el Admin.
 */
export async function updateUserRoleFromAdmin({
  userId,
  role,
  tenantSlug,
}: {
  userId: string
  role: Role
  tenantSlug?: string
}) {
  let tenantId: string | undefined = undefined
  if (tenantSlug) {
    const t = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
    if (t) tenantId = t.id
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      ...(tenantId ? { tenantId } : {}),
    },
    include: { tenant: true },
  })

  return toAuthUser(updated)
}
