import crypto from 'crypto'
import { env } from '@/config/env'

export interface QrTokenPayload {
  orderId: string
  tenantId: string
  userDni?: string
  expiresAt: string // ISO string
  createdAt?: string
}

export interface VerificationResult {
  valid: boolean
  payload?: QrTokenPayload
  error?: 'MALFORMED_TOKEN' | 'INVALID_SIGNATURE' | 'EXPIRED_TOKEN' | 'SECRET_MISSING'
}

/**
 * Obtiene el secreto de firma criptográfica desde las variables de entorno.
 */
function getSigningSecret(): string {
  return env.QR_SIGNING_SECRET
}

/**
 * Genera una firma HMAC-SHA256 para un contenido dado.
 */
export function signData(data: string, secret?: string): string {
  const key = secret || getSigningSecret()
  return crypto.createHmac('sha256', key).update(data).digest('hex')
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function base36ToBigInt(str: string): bigint {
  let result = BigInt(0)
  const radix = BigInt(36)
  for (const ch of str.toUpperCase()) {
    const val = parseInt(ch, 36)
    if (isNaN(val)) throw new Error('Invalid base36 char')
    result = result * radix + BigInt(val)
  }
  return result
}

function encodeOrderIdCompact(orderId: string): string {
  const clean = orderId.trim()
  if (UUID_REGEX.test(clean)) {
    const hex = clean.replace(/-/g, '')
    return `U${BigInt('0x' + hex).toString(36).toUpperCase()}`
  }
  return `X:${Buffer.from(clean, 'utf-8').toString('hex').toUpperCase()}`
}

function decodeOrderIdCompact(encoded: string): string {
  if (encoded.startsWith('U')) {
    const hex = base36ToBigInt(encoded.slice(1)).toString(16).padStart(32, '0')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  }
  if (encoded.startsWith('X:')) {
    return Buffer.from(encoded.slice(2), 'hex').toString('utf-8')
  }
  if (/^[0-9A-F]{32}$/i.test(encoded)) {
    const hex = encoded.toLowerCase()
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  }
  return encoded
}

/**
 * Genera el token QR firmado para una orden.
 * Utiliza formato Alfanumérico Puro en Mayúsculas (ISO/IEC 18004 Alphanumeric Mode: 5.5 bits/char)
 * reduciendo el QR a Versión 3 (29x29 módulos gigantes estilo Posnet Mercado Pago).
 */
export function generateOrderQrToken(payload: QrTokenPayload): {
  token: string
  tokenHash: string
} {
  const orderEnc = encodeOrderIdCompact(payload.orderId)
  const expMinutes = Math.max(1, Math.floor(new Date(payload.expiresAt).getTime() / 60000))
  const expB36 = expMinutes.toString(36).toUpperCase()

  const cleanDni = (payload.userDni || '').replace(/\D/g, '')
  const dniB36 =
    cleanDni && !isNaN(Number(cleanDni)) && Number(cleanDni) > 0
      ? Number(cleanDni).toString(36).toUpperCase()
      : '0'

  const unsignedData = `BO1/${orderEnc}/${expB36}/${dniB36}`
  // Firma HMAC-SHA256 de 56 bits (14 chars Hex en mayúscula) -> 7.2 x 10^16 combinaciones
  const signature = signData(unsignedData).slice(0, 14).toUpperCase()
  const token = `${unsignedData}/${signature}`

  // Hash SHA-256 del token para indexar en la BD sin exponer la firma cruda
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  return { token, tokenHash }
}

/**
 * Verifica la firma criptográfica y la vigencia temporal de un token QR escaneado.
 * Soporta tanto el formato ultrarrápido Posnet V2 (BO1/...) como el formato legacy V1 (base64url.hex).
 */
export function verifyOrderQrToken(token: string): VerificationResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'MALFORMED_TOKEN' }
  }

  const cleanToken = token.trim()

  // 1. Formato Ultracompacto Posnet V2: BO1/<ORDER>/<EXP_B36>/<DNI_B36>/<MAC14>
  if (cleanToken.toUpperCase().startsWith('BO1/')) {
    try {
      const normalized = cleanToken.toUpperCase()
      const parts = normalized.split('/')
      if (parts.length !== 5) {
        return { valid: false, error: 'MALFORMED_TOKEN' }
      }

      const [, orderEnc, expB36, dniB36, providedMac] = parts
      const unsignedData = `BO1/${orderEnc}/${expB36}/${dniB36}`
      const expectedMac = signData(unsignedData).slice(0, 14).toUpperCase()

      const expectedBuffer = Buffer.from(expectedMac, 'hex')
      const providedBuffer = Buffer.from(providedMac, 'hex')

      if (
        expectedBuffer.length === 0 ||
        expectedBuffer.length !== providedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
      ) {
        return { valid: false, error: 'INVALID_SIGNATURE' }
      }

      const orderId = decodeOrderIdCompact(orderEnc)
      const expMinutes = parseInt(expB36, 36)
      if (!orderId || isNaN(expMinutes)) {
        return { valid: false, error: 'MALFORMED_TOKEN' }
      }

      const expirationDate = new Date(expMinutes * 60000)
      const expiresAt = expirationDate.toISOString()
      const userDni =
        dniB36 && dniB36 !== '0' ? String(parseInt(dniB36, 36)) : undefined

      const payload: QrTokenPayload = {
        orderId,
        tenantId: 'verified',
        userDni,
        expiresAt,
      }

      if (new Date() > expirationDate) {
        return { valid: false, payload, error: 'EXPIRED_TOKEN' }
      }

      return { valid: true, payload }
    } catch {
      return { valid: false, error: 'MALFORMED_TOKEN' }
    }
  }

  // 2. Formato Legacy V1 (base64url.signature) para retrocompatibilidad total
  const parts = cleanToken.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'MALFORMED_TOKEN' }
  }

  const [payloadEncoded, providedSignature] = parts

  try {
    const fullExpectedSignature = signData(payloadEncoded)
    const expectedSignature =
      providedSignature.length === 32
        ? fullExpectedSignature.slice(0, 32)
        : fullExpectedSignature

    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    const providedBuffer = Buffer.from(providedSignature, 'hex')

    if (expectedBuffer.length !== providedBuffer.length) {
      return { valid: false, error: 'INVALID_SIGNATURE' }
    }

    const signaturesMatch = crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    if (!signaturesMatch) {
      return { valid: false, error: 'INVALID_SIGNATURE' }
    }

    const jsonString = Buffer.from(payloadEncoded, 'base64url').toString('utf-8')
    const rawPayload = JSON.parse(jsonString)

    const orderId = rawPayload.orderId || rawPayload.o
    const tenantId = rawPayload.tenantId || rawPayload.t
    const userDni = rawPayload.userDni || rawPayload.d
    const expiresAt =
      typeof rawPayload.e === 'number'
        ? new Date(rawPayload.e * 1000).toISOString()
        : rawPayload.expiresAt

    const payload: QrTokenPayload = {
      orderId,
      tenantId,
      userDni,
      expiresAt,
      createdAt: rawPayload.createdAt,
    }

    if (!payload.orderId || !payload.tenantId || !payload.expiresAt) {
      return { valid: false, error: 'MALFORMED_TOKEN' }
    }

    const expirationDate = new Date(payload.expiresAt)
    if (isNaN(expirationDate.getTime()) || new Date() > expirationDate) {
      return { valid: false, payload, error: 'EXPIRED_TOKEN' }
    }

    return { valid: true, payload }
  } catch {
    return { valid: false, error: 'MALFORMED_TOKEN' }
  }
}

/**
 * Calcula el hash SHA-256 de un token QR para búsquedas exactas en la BD.
 */
export function hashQrToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
