import crypto from 'crypto'
import { NextRequest } from 'next/server'

/**
 * "Iniciar sesión con Google" y "Iniciar sesión con Apple" REALES (OAuth 2.0 / OpenID Connect).
 *
 * El usuario es enviado a accounts.google.com / appleid.apple.com, elige su propia cuenta de
 * Gmail / iCloud en la pantalla nativa del proveedor (selector de cuentas de Android/Chrome,
 * Face ID / Touch ID en iPhone/Mac) y vuelve con un código que se canjea del lado del servidor.
 * Nunca se confía en un email enviado por el navegador.
 *
 * Variables de entorno necesarias:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   APPLE_CLIENT_ID (Services ID, ej: com.barraonline.web), APPLE_TEAM_ID, APPLE_KEY_ID,
 *   APPLE_PRIVATE_KEY (contenido del .p8; se aceptan "\n" escapados)
 *   NEXT_PUBLIC_APP_URL (ej: https://barraonline.com) -> define el redirect_uri
 */

export type OAuthProvider = 'google' | 'apple'

export const OAUTH_STATE_COOKIE = 'bo_oauth'

export interface OAuthStatePayload {
  provider: OAuthProvider
  state: string
  nonce: string
  returnTo: string
  tenantSlug: string | null
}

export interface VerifiedIdentity {
  provider: OAuthProvider
  subject: string
  email: string | null
  emailVerified: boolean
  fullName: string | null
  avatarUrl: string | null
}

export function isOAuthProvider(p: string): p is OAuthProvider {
  return p === 'google' || p === 'apple'
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  if (provider === 'google') {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  }
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
  )
}

export function getAppOrigin(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (fromEnv) return fromEnv
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host
  return `${proto}://${host}`
}

export function getRedirectUri(req: NextRequest, provider: OAuthProvider): string {
  return `${getAppOrigin(req)}/api/auth/oauth/${provider}/callback`
}

/** Solo rutas internas relativas: evita open-redirects. */
export function sanitizeReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (value.startsWith('/api/')) return fallback
  return value
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function buildAuthorizationUrl(
  req: NextRequest,
  provider: OAuthProvider,
  state: string,
  nonce: string
): string {
  const redirectUri = getRedirectUri(req, provider)

  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('state', state)
    url.searchParams.set('nonce', nonce)
    url.searchParams.set('prompt', 'select_account')
    return url.toString()
  }

  const url = new URL('https://appleid.apple.com/auth/authorize')
  url.searchParams.set('client_id', process.env.APPLE_CLIENT_ID!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'name email')
  // Apple exige form_post cuando se piden name/email
  url.searchParams.set('response_mode', 'form_post')
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  return url.toString()
}

function decodeJwtPayload(jwt: string): Record<string, any> {
  const parts = jwt.split('.')
  if (parts.length !== 3) throw new Error('id_token inválido')
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
}

/** client_secret de Apple: JWT ES256 firmado con la clave .p8 (válido 5 minutos). */
function createAppleClientSecret(): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'ES256', kid: process.env.APPLE_KEY_ID!, typ: 'JWT' }
  const payload = {
    iss: process.env.APPLE_TEAM_ID!,
    iat: now,
    exp: now + 300,
    aud: 'https://appleid.apple.com',
    sub: process.env.APPLE_CLIENT_ID!,
  }
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const signingInput = `${enc(header)}.${enc(payload)}`
  const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n')
  const signature = crypto
    .sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url')
  return `${signingInput}.${signature}`
}

/**
 * Canjea el código de autorización por un id_token directamente con el proveedor (canal TLS
 * servidor-a-servidor autenticado con client_secret) y valida iss / aud / exp / nonce.
 */
export async function exchangeCodeForIdentity(
  req: NextRequest,
  provider: OAuthProvider,
  code: string,
  expectedNonce: string,
  appleUserJson?: string | null
): Promise<VerifiedIdentity> {
  const redirectUri = getRedirectUri(req, provider)

  const tokenUrl =
    provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://appleid.apple.com/auth/token'
  const clientId = provider === 'google' ? process.env.GOOGLE_CLIENT_ID! : process.env.APPLE_CLIENT_ID!
  const clientSecret =
    provider === 'google' ? process.env.GOOGLE_CLIENT_SECRET! : createAppleClientSecret()

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: 'no-store',
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.id_token) {
    console.error(`[oauth:${provider}] token exchange failed`, res.status, data?.error)
    throw new Error('No se pudo validar la cuenta con el proveedor.')
  }

  const claims = decodeJwtPayload(data.id_token)
  const now = Math.floor(Date.now() / 1000)

  const validIss =
    provider === 'google'
      ? claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com'
      : claims.iss === 'https://appleid.apple.com'
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]

  if (!validIss || !aud.includes(clientId) || !claims.exp || claims.exp < now || !claims.sub) {
    throw new Error('Token del proveedor inválido.')
  }
  if (claims.nonce !== expectedNonce) {
    throw new Error('La sesión de inicio expiró. Probá de nuevo.')
  }

  const emailVerified = claims.email_verified === true || claims.email_verified === 'true'

  let fullName: string | null = claims.name || null
  if (provider === 'apple' && appleUserJson) {
    // Apple solo envía el nombre la PRIMERA vez que el usuario autoriza la app
    try {
      const u = JSON.parse(appleUserJson)
      const n = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' ').trim()
      if (n) fullName = n
    } catch {}
  }

  return {
    provider,
    subject: String(claims.sub),
    email: claims.email ? String(claims.email).toLowerCase() : null,
    emailVerified,
    fullName,
    avatarUrl: provider === 'google' ? claims.picture || null : null,
  }
}

export function encodeState(payload: OAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeState(raw: string | undefined | null): OAuthStatePayload | null {
  if (!raw) return null
  try {
    const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'))
    if (!p?.state || !p?.nonce || !isOAuthProvider(p.provider)) return null
    return p
  } catch {
    return null
  }
}
