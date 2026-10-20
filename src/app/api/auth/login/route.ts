import { NextRequest, NextResponse } from 'next/server'
import { loginAccount } from '@/lib/auth-service'
import { publicSelf, setSessionCookie } from '@/lib/session'

const LOGIN_ATTEMPTS = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos
const MAX_ATTEMPTS = 8

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = LOGIN_ATTEMPTS.get(key)
  if (!entry || now > entry.resetAt) {
    LOGIN_ATTEMPTS.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { identifier, password } = body

    if (!identifier || !password || typeof identifier !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Ingresá tu correo, teléfono o DNI y tu contraseña.' },
        { status: 400 }
      )
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateKey = `${ip}:${identifier.trim().toLowerCase()}`

    if (isRateLimited(rateKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Demasiados intentos de acceso fallidos. Esperá 15 minutos antes de reintentar.',
        },
        { status: 429 }
      )
    }

    const user = await loginAccount({ identifier, password })
    LOGIN_ATTEMPTS.delete(rateKey)

    const res = NextResponse.json({ success: true, user: publicSelf(user) })
    setSessionCookie(res, user)
    return res
  } catch {
    return NextResponse.json(
      { success: false, error: 'Datos de acceso incorrectos.' },
      { status: 401 }
    )
  }
}
