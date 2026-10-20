import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { env } from '@/config/env'

/**
 * "Iniciar sesión con Google" REAL (OAuth 2.0 / OpenID Connect).
 *
 * El usuario es enviado a accounts.google.com, elige su propia cuenta de Gmail
 * en la pantalla oficial de Google y vuelve con un código de autorización que se
 * canjea del lado del servidor por su identidad verificada (id_token).
 *
 * Variables de entorno requeridas:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL (ej: https://barraonline.vercel.app) -> define el redirect_uri
 */

export type OAuthProvider = 'google'

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
  return p === 'google'
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return provider === 'google' && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function getAppOrigin(req: NextRequest): string {
  const url = new URL(req.url)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return `${url.protocol}//${url.host}`
  }
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (fromEnv) return fromEnv
  return `${url.protocol}//${url.host}`
}

export function getRedirectUri(req: NextRequest, provider: OAuthProvider): string {
  return `${getAppOrigin(req)}/api/auth/oauth/${provider}/callback`
}

/** Solo rutas internas relativas seguras: bloquea open-redirects y caracteres de inyección HTML/JS. */
export function sanitizeReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) return fallback
  if (trimmed.startsWith('/api/')) return fallback
  if (!/^\/[a-zA-Z0-9/_?=&%-]*$/.test(trimmed)) return fallback
  return trimmed
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

function decodeJwtPayload(jwt: string): Record<string, any> {
  const parts = jwt.split('.')
  if (parts.length !== 3) throw new Error('id_token inválido')
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
}

/**
 * Canjea el código de autorización por un id_token directamente con Google
 * (canal TLS servidor-a-servidor autenticado con client_secret) y valida iss / aud / exp / nonce.
 */
export async function exchangeCodeForIdentity(
  req: NextRequest,
  provider: OAuthProvider,
  code: string,
  expectedNonce: string,
  _appleUserJson?: string | null
): Promise<VerifiedIdentity> {
  const redirectUri = getRedirectUri(req, provider)

  const tokenUrl = 'https://oauth2.googleapis.com/token'
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!

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
    throw new Error('No se pudo validar la cuenta con Google.')
  }

  const claims = decodeJwtPayload(data.id_token)
  const now = Math.floor(Date.now() / 1000)

  const validIss = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com'
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]

  if (!validIss || !aud.includes(clientId) || !claims.exp || claims.exp < now || !claims.sub) {
    throw new Error('Token de Google inválido.')
  }
  if (claims.nonce !== expectedNonce) {
    throw new Error('La sesión de inicio expiró. Probá de nuevo.')
  }

  const emailVerified = claims.email_verified === true || claims.email_verified === 'true'

  return {
    provider,
    subject: String(claims.sub),
    email: claims.email ? String(claims.email).toLowerCase() : null,
    emailVerified,
    fullName: claims.name || null,
    avatarUrl: claims.picture || null,
  }
}

export function encodeState(payload: OAuthStatePayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', env.AUTH_SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function decodeState(raw: string | undefined | null): OAuthStatePayload | null {
  if (!raw) return null
  try {
    const [data, sig] = raw.split('.')
    if (!data || !sig) return null
    const expectedSig = crypto.createHmac('sha256', env.AUTH_SECRET).update(data).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

    const p = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'))
    if (!p?.state || !p?.nonce || !isOAuthProvider(p.provider)) return null
    return {
      ...p,
      returnTo: sanitizeReturnTo(p.returnTo),
    }
  } catch {
    return null
  }
}
