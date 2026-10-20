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

function getRequiredEnv(key: string, minLength = 16): string {
  const value = process.env[key]?.trim()
  const isBuildPhase =
    process.env.npm_lifecycle_event === 'build' ||
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export'

  if (!value || value.length < minLength) {
    if (isBuildPhase) {
      return crypto.randomBytes(32).toString('hex')
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[CRITICAL CONFIG ERROR] Variable de entorno requerida ausente o insegura: "${key}"`)
    }
    if (!EPHEMERAL_DEV_SECRETS.has(key)) {
      EPHEMERAL_DEV_SECRETS.set(key, crypto.randomBytes(32).toString('hex'))
    }
    return EPHEMERAL_DEV_SECRETS.get(key)!
  }
  return value
}

const qrSecret = getRequiredEnv('QR_SIGNING_SECRET', 32)
const authSecret = getRequiredEnv('AUTH_SECRET', 32)

if (process.env.NODE_ENV === 'production' && qrSecret === authSecret) {
  throw new Error(
    '[CRITICAL CONFIG ERROR] QR_SIGNING_SECRET y AUTH_SECRET deben ser claves criptográficas distintas.'
  )
}

export const env: AppEnvironment = {
  NODE_ENV: (process.env.NODE_ENV as AppEnvironment['NODE_ENV']) || 'development',
  APP_URL: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').trim().replace(/\/+$/, ''),
  DATABASE_URL: getRequiredEnv('DATABASE_URL', 10),
  QR_SIGNING_SECRET: qrSecret,
  AUTH_SECRET: authSecret,
  ALLOW_PAYMENT_SIMULATION:
    process.env.ALLOW_PAYMENT_SIMULATION === 'true' && process.env.NODE_ENV !== 'production',
  ALLOW_OAUTH_SIMULATION:
    process.env.ALLOW_OAUTH_SIMULATION === 'true' && process.env.NODE_ENV !== 'production',
}
