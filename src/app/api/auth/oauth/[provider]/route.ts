import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { env } from '@/config/env'
import {
  OAUTH_STATE_COOKIE,
  buildAuthorizationUrl,
  encodeState,
  escapeHtml,
  getAppOrigin,
  isOAuthProvider,
  isProviderConfigured,
  randomToken,
  sanitizeReturnTo,
} from '@/lib/oauth'
import { socialLoginAccount } from '@/lib/auth-service'
import { setSessionCookie } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/oauth/{google|apple}?returnTo=/demo-club&tenant=demo-club
 * Si el proveedor está configurado con claves en .env -> Flujo oficial Google / Apple OAuth.
 * Si no está configurado -> Selector inteligente o auto-login en 1 clic sin errores.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params
  const sp = req.nextUrl.searchParams
  const returnTo = sanitizeReturnTo(sp.get('returnTo'))
  const tenantParam = sp.get('tenant')
  const tenantSlug = tenantParam && /^[a-z0-9-]{1,64}$/.test(tenantParam) ? tenantParam : 'demo-club'

  // Endpoint de comprobación rápida para la app
  if (sp.get('check') === 'true') {
    return NextResponse.json({
      success: true,
      provider,
      configured: isOAuthProvider(provider) ? isProviderConfigured(provider) : false,
    })
  }

  const backWithError = (msg: string) => {
    const url = new URL(returnTo, getAppOrigin(req))
    url.searchParams.set('auth_error', msg)
    return NextResponse.redirect(url, 303)
  }

  if (!isOAuthProvider(provider)) return backWithError('Proveedor no válido.')

  // Si tiene claves reales configuradas en .env
  if (isProviderConfigured(provider)) {
    const state = randomToken()
    const nonce = randomToken()
    const res = NextResponse.redirect(buildAuthorizationUrl(req, provider, state, nonce), 303)

    res.cookies.set(OAUTH_STATE_COOKIE, encodeState({ provider, state, nonce, returnTo, tenantSlug }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth/oauth',
      maxAge: 10 * 60,
    })

    return res
  }

  // SI NO TIENE CLAVES REALES CONFIGURADAS EN .ENV:
  if (!env.ALLOW_OAUTH_SIMULATION) {
    return backWithError('Autenticación externa no disponible.')
  }

  // Si se solicita auto-login directo (?auto=true)
  if (sp.get('auto') === 'true') {
    const defaultEmail = provider === 'google' ? 'cliente.google@gmail.com' : 'cliente.apple@icloud.com'
    const defaultName = provider === 'google' ? 'Usuario Google' : 'Usuario Apple ID'

    const user = await socialLoginAccount({
      provider,
      subject: `demo_${provider}_${crypto.randomBytes(6).toString('hex')}`,
      email: defaultEmail,
      emailVerified: true,
      fullName: defaultName,
      avatarUrl: provider === 'google' ? 'https://lh3.googleusercontent.com/a/default-user=s96-c' : null,
      tenantSlug,
    })

    const targetUrl = new URL(returnTo, getAppOrigin(req))
    targetUrl.searchParams.set('auth', 'ok')
    const res = NextResponse.redirect(targetUrl, 303)
    setSessionCookie(res, user)
    return res
  }

  // Renderizar la pantalla interactiva oficial de selección de cuenta Google / Apple
  const isGoogle = provider === 'google'
  const brandTitle = isGoogle ? 'Acceder con Google' : 'Iniciar sesión con Apple ID'
  const brandSub = isGoogle
    ? 'Elegí tu cuenta para continuar tu pedido en BarraOnline'
    : 'Usá tu Apple ID para acceder de forma rápida y segura'
  const defaultEmail = isGoogle ? 'cliente.google@gmail.com' : 'cliente.apple@icloud.com'
  const defaultName = isGoogle ? 'Usuario Google' : 'Usuario Apple ID'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${brandTitle} • BarraOnline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #08080c;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .card {
      background: #111118;
      border: 1px solid ${isGoogle ? 'rgba(66, 133, 244, 0.3)' : 'rgba(255, 255, 255, 0.15)'};
      border-radius: 24px;
      padding: 2rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .header { text-align: center; margin-bottom: 1.75rem; }
    .logo { width: 44px; height: 44px; margin: 0 auto 0.75rem; display: block; }
    h1 { font-size: 1.35rem; font-weight: 700; color: #fff; margin-bottom: 0.35rem; }
    p { font-size: 0.825rem; color: #94a3b8; line-height: 1.4; }
    .badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 9999px;
      background: ${isGoogle ? 'rgba(66, 133, 244, 0.15)' : 'rgba(255, 255, 255, 0.1)'};
      color: ${isGoogle ? '#93c5fd' : '#cbd5e1'};
      border: 1px solid ${isGoogle ? 'rgba(66, 133, 244, 0.3)' : 'rgba(255, 255, 255, 0.2)'};
      margin-top: 0.5rem;
    }
    .quick-btn {
      width: 100%;
      background: ${isGoogle ? '#ffffff' : '#1e1e24'};
      color: ${isGoogle ? '#0f172a' : '#ffffff'};
      border: 1px solid ${isGoogle ? '#ffffff' : 'rgba(255, 255, 255, 0.2)'};
      border-radius: 16px;
      padding: 0.9rem 1rem;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.2s;
      margin-bottom: 1.25rem;
    }
    .quick-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 20px -5px rgba(0,0,0,0.5);
    }
    .quick-btn .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: ${isGoogle ? '#4285F4' : '#ffffff'};
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.85rem;
    }
    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 1.25rem 0;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .divider span { padding: 0 0.75rem; }
    .form-group { margin-bottom: 0.85rem; }
    label { display: block; font-size: 0.75rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.35rem; }
    input {
      width: 100%;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 0.7rem 0.85rem;
      color: #fff;
      font-size: 0.85rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: ${isGoogle ? '#4285F4' : '#a855f7'}; }
    .submit-btn {
      width: 100%;
      background: ${isGoogle ? 'linear-gradient(135deg, #4285F4, #34A853)' : 'linear-gradient(135deg, #8B5CF6, #EC4899)'};
      color: #fff;
      border: none;
      border-radius: 14px;
      padding: 0.85rem;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
      margin-top: 0.5rem;
      transition: opacity 0.2s;
    }
    .submit-btn:hover { opacity: 0.95; }
    .cancel-link {
      display: block;
      text-align: center;
      margin-top: 1.25rem;
      font-size: 0.8rem;
      color: #64748b;
      text-decoration: none;
    }
    .cancel-link:hover { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${
        isGoogle
          ? `<svg class="logo" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"/></svg>`
          : `<svg class="logo" fill="#ffffff" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`
      }
      <h1>${brandTitle}</h1>
      <p>${brandSub}</p>
      <span class="badge">Acceso Directo Inteligente</span>
    </div>

    <!-- Opción 1: Acceso en 1 clic -->
    <form method="POST" action="/api/auth/oauth/${provider}">
      <input type="hidden" name="returnTo" value="${encodeURIComponent(returnTo)}">
      <input type="hidden" name="tenantSlug" value="${encodeURIComponent(tenantSlug)}">
      <input type="hidden" name="email" value="${defaultEmail}">
      <input type="hidden" name="fullName" value="${defaultName}">
      <button type="submit" class="quick-btn">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div class="avatar">${isGoogle ? 'G' : ''}</div>
          <div style="text-align:left;">
            <div>${defaultName}</div>
            <div style="font-size:0.75rem; font-weight:normal; opacity:0.7;">${defaultEmail}</div>
          </div>
        </div>
        <span style="font-size:0.75rem; opacity:0.8;">1 clic &rarr;</span>
      </button>
    </form>

    <div class="divider"><span>o usar otra cuenta</span></div>

    <!-- Opción 2: Ingresar email personalizado -->
    <form method="POST" action="/api/auth/oauth/${provider}">
      <input type="hidden" name="returnTo" value="${encodeURIComponent(returnTo)}">
      <input type="hidden" name="tenantSlug" value="${encodeURIComponent(tenantSlug)}">
      
      <div class="form-group">
        <label>Correo Electrónico (${isGoogle ? 'Gmail' : 'iCloud'})</label>
        <input type="email" name="email" required placeholder="${isGoogle ? 'tunombre@gmail.com' : 'tunombre@icloud.com'}">
      </div>

      <div class="form-group">
        <label>Nombre y Apellido</label>
        <input type="text" name="fullName" placeholder="Tu Nombre">
      </div>

      <button type="submit" class="submit-btn">Continuar con ${isGoogle ? 'Google' : 'Apple'}</button>
    </form>

    <a href="${escapeHtml(returnTo)}" class="cancel-link">&larr; Cancelar y volver al boliche</a>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

/**
 * POST /api/auth/oauth/{google|apple}
 * Procesa la autenticación social simulada y establece la cookie de sesión.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  if (!env.ALLOW_OAUTH_SIMULATION) {
    return NextResponse.json(
      { success: false, error: 'Endpoint de simulación OAuth deshabilitado en este entorno' },
      { status: 403 }
    )
  }

  const { provider } = await ctx.params
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ success: false, error: 'Proveedor no válido.' }, { status: 400 })
  }

  try {
    let email = ''
    let fullName = ''
    let returnTo = '/'
    let tenantSlug = 'demo-club'

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await req.json()
      email = body.email || ''
      fullName = body.fullName || ''
      returnTo = body.returnTo || '/'
      tenantSlug = body.tenantSlug || 'demo-club'
    } else {
      const formData = await req.formData()
      email = (formData.get('email') as string) || ''
      fullName = (formData.get('fullName') as string) || ''
      returnTo = (formData.get('returnTo') as string) || '/'
      tenantSlug = (formData.get('tenantSlug') as string) || 'demo-club'
    }

    const cleanEmail =
      email.trim().toLowerCase() ||
      (provider === 'google' ? 'cliente.google@gmail.com' : 'cliente.apple@icloud.com')
    const cleanName =
      fullName.trim() ||
      (provider === 'google' ? 'Usuario Google' : 'Usuario Apple ID')
    const subject = `demo_${provider}_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`

    const user = await socialLoginAccount({
      provider,
      subject,
      email: cleanEmail,
      emailVerified: true,
      fullName: cleanName,
      avatarUrl: provider === 'google' ? 'https://lh3.googleusercontent.com/a/default-user=s96-c' : null,
      tenantSlug,
    })

    const sanitizedReturnTo = sanitizeReturnTo(returnTo)

    if (contentType.includes('application/json')) {
      const res = NextResponse.json({
        success: true,
        user,
      })
      setSessionCookie(res, user)
      return res
    }

    const targetUrl = new URL(sanitizedReturnTo, getAppOrigin(req))
    targetUrl.searchParams.set('auth', 'ok')
    const res = NextResponse.redirect(targetUrl, 303)
    setSessionCookie(res, user)
    return res
  } catch (error: any) {
    console.error(`[POST /api/auth/oauth/${provider}] Error:`, error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al iniciar sesión social.' },
      { status: 500 }
    )
  }
}
