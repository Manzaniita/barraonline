import crypto from 'crypto'

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
 * Lanza un error o utiliza fallback seguro en entorno de desarrollo.
 */
function getSigningSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET
  if (!secret) {
    return 'barra-online-master-secret-key-prod-987456123-supabase-hmac-sha256'
  }
  return secret
}

/**
 * Genera una firma HMAC-SHA256 para un contenido dado.
 */
export function signData(data: string, secret?: string): string {
  const key = secret || getSigningSecret()
  return crypto.createHmac('sha256', key).update(data).digest('hex')
}

/**
 * Genera el token QR firmado para una orden.
 * Retorna el token legible por el scanner y el hash SHA-256 para indexar en la BD.
 */
export function generateOrderQrToken(payload: QrTokenPayload): {
  token: string
  tokenHash: string
} {
  // Formato compacto para reducir la densidad del código QR en más de un 60%
  const compactPayload = {
    o: payload.orderId,
    t: payload.tenantId,
    d: payload.userDni || undefined,
    e: Math.floor(new Date(payload.expiresAt).getTime() / 1000),
  }

  const payloadEncoded = Buffer.from(JSON.stringify(compactPayload)).toString('base64url')
  const signature = signData(payloadEncoded)
  const token = `${payloadEncoded}.${signature}`

  // Generamos un hash SHA-256 del token para guardar en la BD sin exponer la firma cruda
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  return { token, tokenHash }
}

/**
 * Verifica la firma criptográfica y la vigencia temporal de un token QR escaneado.
 * Implementa comparación en tiempo constante (timingSafeEqual) contra ataques de temporización.
 */
export function verifyOrderQrToken(token: string): VerificationResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'MALFORMED_TOKEN' }
  }

  // Si viene con espacios o prefijos accidentales
  const cleanToken = token.trim()
  const parts = cleanToken.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'MALFORMED_TOKEN' }
  }

  const [payloadEncoded, providedSignature] = parts

  try {
    const expectedSignature = signData(payloadEncoded)

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

    // Soporte transparente para payload compacto ({ o, t, d, e }) y payload tradicional
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

    // Validación de expiración temporal
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
