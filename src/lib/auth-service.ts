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
  const payload = {
    id: user.id,
    email: user.email,
    phone: user.phone,
    dni: user.dni,
    fullName: user.fullName,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    authProvider: user.authProvider,
    hasPassword: user.hasPassword,
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

    if (signature !== expectedSig) return null

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

  const user = await prisma.user.findFirst({
    where: { OR: orConditions },
    include: { tenant: true },
  })

  if (!user) {
    throw new Error('No encontramos una cuenta con ese correo, teléfono o DNI.')
  }

  if (!user.passwordHash) {
    throw new Error(
      'Esta cuenta aún no tiene contraseña configurada. Usá la pestaña "Crear Cuenta" con tu DNI o correo para crear tu clave.'
    )
  }

  const isValid = verifyPassword(password, user.passwordHash)
  if (!isValid) {
    throw new Error('Contraseña incorrecta.')
  }

  return toAuthUser(user)
}

/**
 * Inicia sesión o registra gratuitamente con Google o Apple en 1 clic.
 * Si no existe la cuenta la crea automáticamente; si existe inicia sesión sola.
 */
export async function socialLoginAccount({
  provider,
  email,
  fullName,
  providerId,
  avatarUrl,
  dni,
  phone,
  tenantSlug,
}: {
  provider: 'google' | 'apple'
  email: string
  fullName?: string
  providerId?: string
  avatarUrl?: string
  dni?: string
  phone?: string
  tenantSlug?: string
}): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase()
  const cleanDni = dni?.replace(/\D/g, '') || null
  const cleanPhone = phone?.replace(/\D/g, '') || null

  // Derivar nombre legible desde el email si el proveedor no lo envió
  const derivedName =
    fullName?.trim() ||
    cleanEmail
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())

  let tenantId: string | null = null
  if (tenantSlug) {
    const t = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
    if (t) tenantId = t.id
  }

  const orConditions: any[] = [{ email: cleanEmail }]
  if (providerId) orConditions.push({ authProviderId: providerId })
  if (cleanDni) orConditions.push({ dni: cleanDni })

  const existing = await prisma.user.findFirst({
    where: { OR: orConditions },
    include: { tenant: true },
  })

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: cleanEmail || existing.email,
        fullName: existing.fullName || derivedName,
        dni: cleanDni || existing.dni,
        phone: cleanPhone || existing.phone,
        avatarUrl: avatarUrl || existing.avatarUrl,
        authProvider: provider,
        authProviderId: existing.authProviderId || providerId || `${provider}-${cleanEmail}`,
      },
      include: { tenant: true },
    })
    return toAuthUser(updated)
  }

  const created = await prisma.user.create({
    data: {
      email: cleanEmail,
      fullName: derivedName,
      dni: cleanDni,
      phone: cleanPhone,
      avatarUrl: avatarUrl || null,
      authProvider: provider,
      authProviderId: providerId || `${provider}-${cleanEmail}`,
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
    if (user.passwordHash && currentPassword) {
      const validCurrent = verifyPassword(currentPassword, user.passwordHash)
      if (!validCurrent) {
        throw new Error('La contraseña actual ingresada es incorrecta.')
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
}: {
  tenantSlug?: string
  search?: string
}) {
  const whereClause: any = {}

  if (search && search.trim()) {
    const q = search.trim()
    whereClause.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { dni: { contains: q } },
      { phone: { contains: q } },
    ]
  }

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
