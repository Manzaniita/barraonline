// src/config/env.ts

export interface AppEnvironment {
  NODE_ENV: 'development' | 'production' | 'test'
  APP_URL: string
  DATABASE_URL: string
  QR_SIGNING_SECRET: string
  AUTH_SECRET: string
  ALLOW_PAYMENT_SIMULATION: boolean
  ALLOW_OAUTH_SIMULATION: boolean
}

function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[CRITICAL CONFIG ERROR] Variable de entorno requerida ausente: "${key}"`)
    }
    return `dev-local-${key.toLowerCase()}`
  }
  return value
}

export const env: AppEnvironment = {
  NODE_ENV: (process.env.NODE_ENV as AppEnvironment['NODE_ENV']) || 'development',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  DATABASE_URL: getRequiredEnv('DATABASE_URL'),
  QR_SIGNING_SECRET: getRequiredEnv('QR_SIGNING_SECRET'),
  AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || getRequiredEnv('AUTH_SECRET'),
  ALLOW_PAYMENT_SIMULATION:
    process.env.ALLOW_PAYMENT_SIMULATION === 'true' && process.env.NODE_ENV !== 'production',
  ALLOW_OAUTH_SIMULATION:
    process.env.ALLOW_OAUTH_SIMULATION === 'true' && process.env.NODE_ENV !== 'production',
}
