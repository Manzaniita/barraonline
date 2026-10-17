import { NextRequest, NextResponse } from 'next/server'
import {
  OAUTH_STATE_COOKIE,
  buildAuthorizationUrl,
  encodeState,
  getAppOrigin,
  isOAuthProvider,
  isProviderConfigured,
  randomToken,
  sanitizeReturnTo,
} from '@/lib/oauth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/oauth/{google|apple}?returnTo=/demo-club&tenant=demo-club
 * Redirige a la pantalla oficial de Google / Apple para elegir la cuenta.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get('returnTo'))
  const tenantParam = req.nextUrl.searchParams.get('tenant')
  const tenantSlug = tenantParam && /^[a-z0-9-]{1,64}$/.test(tenantParam) ? tenantParam : null

  const backWithError = (msg: string) => {
    const url = new URL(returnTo, getAppOrigin(req))
    url.searchParams.set('auth_error', msg)
    return NextResponse.redirect(url, 303)
  }

  if (!isOAuthProvider(provider)) return backWithError('Proveedor no vÃ¡lido.')
  if (!isProviderConfigured(provider)) {
    return backWithError(
      provider === 'google'
        ? 'El inicio con Google todavÃ­a no estÃ¡ configurado.'
        : 'El inicio con Apple todavÃ­a no estÃ¡ configurado.'
    )
  }

  const state = randomToken()
  const nonce = randomToken()
  const res = NextResponse.redirect(buildAuthorizationUrl(req, provider, state, nonce), 303)

  res.cookies.set(OAUTH_STATE_COOKIE, encodeState({ provider, state, nonce, returnTo, tenantSlug }), {
    httpOnly: true,
    // Apple vuelve con un POST cross-site (form_post): la cookie necesita SameSite=None + Secure
    sameSite: provider === 'apple' ? 'none' : 'lax',
    secure: provider === 'apple' ? true : process.env.NODE_ENV === 'production',
    path: '/api/auth/oauth',
    maxAge: 10 * 60,
  })

  return res
}
