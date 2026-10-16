import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import crypto from 'crypto'
import { generateOrderQrToken } from './crypto'

export interface CheckoutCustomerInput {
  dni: string
  fullName: string
  phone?: string
  email?: string
}

export interface CheckoutItemInput {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  redeemDeadlineTime?: string | null
}

/**
 * Crea una instancia configurada del SDK de Mercado Pago
 * utilizando el access token propio del boliche.
 */
export function getMercadoPagoClient(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken,
    options: {
      timeout: 8000,
    },
  })
}

/**
 * Calcula la fecha y hora de expiración de la noche según la hora de corte
 * configurada por el boliche (por defecto: 07:00 AM).
 */
export function calculateExpirationDate(defaultExpirationHour: string = '07:00'): Date {
  const [targetHour, targetMinute] = defaultExpirationHour.split(':').map(Number)
  const now = new Date()
  const exp = new Date(now)

  exp.setHours(targetHour, targetMinute, 0, 0)

  // Si ya pasamos la hora de corte hoy, expira en la próxima mañana
  if (now.getTime() >= exp.getTime()) {
    exp.setDate(exp.getDate() + 1)
  }

  return exp
}

/**
 * Calcula la fecha y hora límite para un trago promo con horario fijo (ej: 02:30).
 */
export function calculatePromoDeadline(deadlineTime: string): Date {
  const [targetHour, targetMinute] = deadlineTime.split(':').map(Number)
  const now = new Date()
  const deadline = new Date(now)

  deadline.setHours(targetHour, targetMinute, 0, 0)

  // Si la compra se hace temprano en la noche (ej. 23:00) y el corte es 02:30,
  // el corte es en la madrugada del día siguiente.
  if (now.getHours() >= 12 && targetHour < 12) {
    deadline.setDate(deadline.getDate() + 1)
  }

  return deadline
}

/**
 * Valida la firma criptográfica x-signature enviada por Mercado Pago en sus webhooks.
 * Header formato: ts=1700000000,v1=hash
 */
export function verifyMercadoPagoWebhookSignature({
  xSignature,
  dataId,
  secret,
}: {
  xSignature: string | null
  dataId: string
  secret?: string | null
}): boolean {
  if (!secret) {
    // Si el boliche aún no cargó su webhook secret, permitimos continuar
    return true
  }

  if (!xSignature) return false

  try {
    const parts = xSignature.split(',')
    let ts = ''
    let v1 = ''

    for (const part of parts) {
      const [key, val] = part.split('=')
      if (key.trim() === 'ts') ts = val.trim()
      if (key.trim() === 'v1') v1 = val.trim()
    }

    if (!ts || !v1) return false

    // Manifest que firma Mercado Pago
    const manifest = `id:${dataId};request-id:;ts:${ts};`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex')

    return expectedSignature === v1
  } catch {
    return false
  }
}

/**
 * Genera la preferencia de pago de Checkout Pro en Mercado Pago.
 */
export async function createMercadoPagoPreference({
  client,
  tenantSlug,
  orderId,
  items,
  customer,
  feePercentage = 0,
  baseUrl,
}: {
  client: MercadoPagoConfig
  tenantSlug: string
  orderId: string
  items: CheckoutItemInput[]
  customer: CheckoutCustomerInput
  feePercentage?: number
  baseUrl: string
}) {
  const preferenceApi = new Preference(client)

  // Desglosar nombre y apellido
  const nameParts = customer.fullName.trim().split(' ')
  const firstName = nameParts[0] || 'Cliente'
  const lastName = nameParts.slice(1).join(' ') || 'BarraOnline'

  const totalAmount = items.reduce((acc, curr) => acc + curr.unitPrice * curr.quantity, 0)
  
  // Comisión de plataforma opcional si está configurada en SuperAdmin
  const marketplaceFee = feePercentage > 0 ? (totalAmount * feePercentage) / 100 : undefined

  const mpItems = items.map((item) => ({
    id: item.productId,
    title: item.name,
    unit_price: item.unitPrice,
    quantity: item.quantity,
    currency_id: 'ARS',
  }))

  const response = await preferenceApi.create({
    body: {
      items: mpItems,
      payer: {
        name: firstName,
        surname: lastName,
        email: customer.email || `${customer.dni}@barraonline.com`,
        identification: {
          type: 'DNI',
          number: customer.dni,
        },
        phone: customer.phone ? { number: customer.phone } : undefined,
      },
      external_reference: orderId,
      marketplace_fee: marketplaceFee,
      notification_url: `${baseUrl}/api/webhooks/mercadopago/${tenantSlug}`,
      back_urls: {
        success: `${baseUrl}/${tenantSlug}/orden/${orderId}?status=approved`,
        pending: `${baseUrl}/${tenantSlug}/orden/${orderId}?status=pending`,
        failure: `${baseUrl}/${tenantSlug}/orden/${orderId}?status=failure`,
      },
      auto_return: 'approved',
      statement_descriptor: 'BARRA ONLINE QR',
    },
  })

  return {
    preferenceId: response.id,
    initPoint: response.init_point,
    sandboxInitPoint: response.sandbox_init_point,
  }
}
