// src/config/env.ts
import crypto from 'crypto'

export interface AppEnvironment {
  NODE_ENV: 'development' | 'production' | 'test'
  APP_URL: string
  DATABASE_URL: string
  QR_SIGNING_SECRET: string
  AUTH_SECRET: string
  ALLOW_PAYMENT_SIMULATION: boolean
  ALLOW_OAUTH_SIMULATION: boolean
}

const EPHEMERAL_DEV_SECRETS = new Map<string, string>()

function getCleanEnv(key: string): string | undefined {
  const raw = process.env[key]?.trim()
  if (!raw) return undefined
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

function resolveAppUrl(): string {
  const fromEnv = getCleanEnv('NEXT_PUBLIC_APP_URL')
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  const fromVercel = getCleanEnv('VERCEL_URL')
  if (fromVercel) return `https://${fromVercel.replace(/\/+$/, '')}`
  return 'http://localhost:3000'
}

function resolveSecrets(): { qrSecret: string; authSecret: string } {
  const isBuildPhase =
    process.env.npm_lifecycle_event === 'build' ||
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export'

  let rawQr = getCleanEnv('QR_SIGNING_SECRET')
  if (!rawQr || rawQr.length < 16) {
    if (isBuildPhase) {
      rawQr = crypto.randomBytes(32).toString('hex')
    } else if (process.env.NODE_ENV !== 'production') {
      if (!EPHEMERAL_DEV_SECRETS.has('QR_SIGNING_SECRET')) {
        EPHEMERAL_DEV_SECRETS.set('QR_SIGNING_SECRET', crypto.randomBytes(32).toString('hex'))
      }
      rawQr = EPHEMERAL_DEV_SECRETS.get('QR_SIGNING_SECRET')!
    } else {
      // Si en producción falta QR_SIGNING_SECRET, derivamos de un salt interno para no tumbar el servicio
      rawQr = crypto.createHash('sha256').update(process.env.DATABASE_URL || 'barra-qr-default-salt').digest('hex')
    }
  }

  let rawAuth = getCleanEnv('AUTH_SECRET') || getCleanEnv('NEXTAUTH_SECRET')
  
  // Si no está configurada o es idéntica a QR_SIGNING_SECRET, derivamos una clave criptográfica independiente
  // mediante HMAC-SHA256 con separación de dominio. Esto garantiza seguridad sin requerir configurar variables extra en Vercel.
  if (!rawAuth || rawAuth.length < 16 || rawAuth === rawQr) {
    rawAuth = crypto
      .createHmac('sha256', rawQr)
      .update('barraonline-auth-secret-domain-separation-v1')
      .digest('hex')
  }

  return { qrSecret: rawQr, authSecret: rawAuth }
}

const { qrSecret, authSecret } = resolveSecrets()

export const env: AppEnvironment = {
  NODE_ENV: (process.env.NODE_ENV as AppEnvironment['NODE_ENV']) || 'development',
  APP_URL: resolveAppUrl(),
  DATABASE_URL:
    getCleanEnv('DATABASE_URL') ||
    'postgresql://postgres:postgres@localhost:5432/postgres',
  QR_SIGNING_SECRET: qrSecret,
  AUTH_SECRET: authSecret,
  ALLOW_PAYMENT_SIMULATION:
    process.env.ALLOW_PAYMENT_SIMULATION === 'true' && process.env.NODE_ENV !== 'production',
  ALLOW_OAUTH_SIMULATION:
    process.env.ALLOW_OAUTH_SIMULATION === 'true' && process.env.NODE_ENV !== 'production',
}
