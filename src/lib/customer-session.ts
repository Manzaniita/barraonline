export interface CustomerProfile {
  dni: string
  fullName: string
  phone?: string
  email?: string
  userId?: string
  role?: 'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'
  tenantSlug?: string
  authProvider?: string
  hasPassword?: boolean
}

const STORAGE_KEY = 'barraonline_customer_session_v1'

/**
 * Valida formato básico de DNI argentino (6 a 9 dígitos numéricos).
 */
export function isValidDni(dni: string): boolean {
  const clean = dni.replace(/\D/g, '')
  return clean.length >= 7 && clean.length <= 9
}

/**
 * Valida que el nombre completo tenga al menos 2 palabras.
 */
export function isValidFullName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length >= 3
}

/**
 * Obtiene el perfil del usuario guardado en el navegador (persistencia de 90 días).
 */
export function getSavedCustomerProfile(): CustomerProfile | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const data = JSON.parse(raw)
    if (data && (data.dni || data.email || data.phone || data.userId) && data.fullName) {
      return data as CustomerProfile
    }
    return null
  } catch {
    return null
  }
}

/**
 * Guarda el perfil del usuario en localStorage y en cookies para persistir 90 días.
 */
export function saveCustomerProfile(profile: CustomerProfile): void {
  if (typeof window === 'undefined') return

  try {
    const cleanProfile: CustomerProfile = {
      dni: (profile.dni || '').replace(/\D/g, ''),
      fullName: (profile.fullName || 'Usuario').trim(),
      phone: profile.phone?.trim() || undefined,
      email: profile.email?.trim().toLowerCase() || undefined,
      userId: profile.userId,
      role: profile.role || 'CUSTOMER',
      tenantSlug: profile.tenantSlug || undefined,
      authProvider: profile.authProvider || 'credentials',
      hasPassword: profile.hasPassword,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanProfile))

    // Guardamos una cookie con max-age de 90 días para que el backend la lea en SSR
    const maxAge = 90 * 24 * 60 * 60 // 90 días en segundos
    document.cookie = `bo_customer=${encodeURIComponent(JSON.stringify(cleanProfile))}; path=/; max-age=${maxAge}; SameSite=Lax`
  } catch (err) {
    console.error('Error guardando perfil del cliente:', err)
  }
}

/**
 * Elimina la sesión del usuario en caso de requerir cierre.
 */
export function clearCustomerProfile(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  document.cookie = 'bo_customer=; path=/; max-age=0'
  document.cookie = 'bo_session=; path=/; max-age=0'
}
