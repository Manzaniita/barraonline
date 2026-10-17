import { NextRequest, NextResponse } from 'next/server'
import { socialLoginAccount } from '@/lib/auth-service'
import { setSessionCookie } from '@/lib/session'
import {
  OAUTH_STATE_COOKIE,
  decodeState,
  exchangeCodeForIdentity,
  getAppOrigin,
  isOAuthProvider,
} from '@/lib/oauth'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ provider: string }> }

async function handleCallback(
  req: NextRequest,
  providerParam: string,
  fields: { code: string | null; state: string | null; error: string | null; user: string | null }
) {
  const saved = decodeState(req.cookies.get(OAUTH_STATE_COOKIE)?.value)
  const returnTo = saved?.returnTo || '/'

  const finish = (errorMsg?: string) => {
    const url = new URL(returnTo, getAppOrigin(req))
    if (errorMsg) url.searchParams.set('auth_error', errorMsg)
    else url.searchParams.set('auth', 'ok')
    const res = NextResponse.redirect(url, 303)
    res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/api/auth/oauth', maxAge: 0 })
    return res
  }

  if (!isOAuthProvider(providerParam)) return finish('Proveedor no vÃ¡lido.')

  // El usuario cancelÃ³ en la pantalla de Google/Apple
  if (fields.error) {
    const cancelled = fields.error === 'access_denied' || fields.error === 'user_cancelled_authorize'
    return finish(cancelled ? 'Inicio de sesiÃ³n cancelado.' : 'No se pudo iniciar sesiÃ³n.')
  }

  if (
    !saved ||
    saved.provider !== providerParam ||
    !fields.state ||
    fields.state !== saved.state ||
    !fields.code
  ) {
    return finish('La sesiÃ³n de inicio expirÃ³. ProbÃ¡ de nuevo.')
  }

  try {
    const identity = await exchangeCodeForIdentity(
      req,
      providerParam,
      fields.code,
      saved.nonce,
      fields.user
    )

    const user = await socialLoginAccount({
      provider: identity.provider,
      subject: identity.subject,
      email: identity.email,
      emailVerified: identity.emailVerified,
      fullName: identity.fullName,
      avatarUrl: identity.avatarUrl,
      tenantSlug: saved.tenantSlug,
    })

    const res = finish()
    setSessionCookie(res, user)
    return res
  } catch (err: any) {
    console.error(`[oauth:${providerParam}] callback error`, err?.message || err)
    return finish(err?.message || 'No se pudo iniciar sesiÃ³n.')
  }
}

/** Google vuelve por GET */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { provider } = await ctx.params
  const sp = req.nextUrl.searchParams
  return handleCallback(req, provider, {
    code: sp.get('code'),
    state: sp.get('state'),
    error: sp.get('error'),
    user: null,
  })
}

/** Apple vuelve por POST (response_mode=form_post) */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { provider } = await ctx.params
  const form = await req.formData().catch(() => null)
  const get = (k: string) => {
    const v = form?.get(k)
    return typeof v === 'string' ? v : null
  }
  return handleCallback(req, provider, {
    code: get('code'),
    state: get('state'),
    error: get('error'),
    user: get('user'),
  })
}
