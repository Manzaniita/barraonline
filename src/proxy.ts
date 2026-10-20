import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth-service'
import { SESSION_COOKIE } from '@/lib/session'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1) /superadmin/*
  if (pathname === '/superadmin' || pathname.startsWith('/superadmin/')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value
    const decoded = token ? verifySessionToken(token) : null
    if (!decoded?.id) {
      return NextResponse.redirect(new URL('/mi-cuenta', req.url))
    }
    return NextResponse.next()
  }

  // 2) /[tenantSlug]/admin o /[tenantSlug]/barra
  const match = pathname.match(/^\/([^/]+)\/(admin|barra)(\/|$)/)
  if (match && match[1] !== 'api' && match[1] !== '_next') {
    const tenantSlug = match[1]
    const token = req.cookies.get(SESSION_COOKIE)?.value
    const decoded = token ? verifySessionToken(token) : null
    if (!decoded?.id) {
      return NextResponse.redirect(new URL(`/${tenantSlug}`, req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/superadmin/:path*', '/:tenantSlug/admin/:path*', '/:tenantSlug/barra/:path*'],
}
