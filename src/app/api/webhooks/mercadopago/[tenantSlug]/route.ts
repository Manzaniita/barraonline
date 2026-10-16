import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMercadoPagoClient, verifyMercadoPagoWebhookSignature } from '@/lib/mercadopago'
import { Payment } from 'mercadopago'
import { generateOrderQrToken } from '@/lib/crypto'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params
    const xSignature = req.headers.get('x-signature')

    // Extraer data de body o query params
    let paymentId: string | null = null
    let topic: string | null = null

    try {
      const body = await req.json()
      if (body?.data?.id) {
        paymentId = String(body.data.id)
      } else if (body?.id) {
        paymentId = String(body.id)
      }
      topic = body?.type || body?.action || null
    } catch {
      // Si el body viene vacío, leemos query params
      const searchParams = req.nextUrl.searchParams
      paymentId = searchParams.get('id') || searchParams.get('data.id')
      topic = searchParams.get('topic') || searchParams.get('type')
    }

    if (!paymentId) {
      return NextResponse.json({ message: 'Notificación sin ID de pago ignorada.' }, { status: 200 })
    }

    // 1. Obtener tenant desde la base de datos
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado.' }, { status: 404 })
    }

    // 2. Validación de firma x-signature (si el tenant configuró webhook secret)
    if (tenant.mpWebhookSecret) {
      const isValidSig = verifyMercadoPagoWebhookSignature({
        xSignature,
        dataId: paymentId,
        secret: tenant.mpWebhookSecret,
      })

      if (!isValidSig) {
        console.warn(`[Webhook MP] Firma criptográfica inválida para tenant ${tenantSlug}`)
        return NextResponse.json({ error: 'Firma criptográfica inválida.' }, { status: 401 })
      }
    }

    // 3. Consultar estado real del pago directo a la API de Mercado Pago
    if (!tenant.mpAccessTokenEnc) {
      return NextResponse.json({ error: 'Tenant sin credenciales de cobro.' }, { status: 400 })
    }

    const mpClient = getMercadoPagoClient(tenant.mpAccessTokenEnc)
    const paymentApi = new Payment(mpClient)
    const paymentData = await paymentApi.get({ id: paymentId })

    if (!paymentData) {
      return NextResponse.json({ error: 'Pago no encontrado en Mercado Pago.' }, { status: 404 })
    }

    const orderId = paymentData.external_reference
    const paymentStatus = paymentData.status

    if (!orderId) {
      return NextResponse.json({ message: 'Pago sin external_reference (no pertenece a una orden).' }, { status: 200 })
    }

    // 4. Procesamiento IDEMPOTENTE de la orden
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada en base de datos.' }, { status: 404 })
    }

    // Si ya fue aprobada y activada previamente, responder 200 de inmediato (idempotencia)
    if (order.status === 'ACTIVE' && order.mpPaymentId === String(paymentId)) {
      return NextResponse.json({ status: 'already_processed', orderId }, { status: 200 })
    }

    if (paymentStatus === 'approved') {
      // Generar token QR criptográfico firmado
      const { tokenHash } = generateOrderQrToken({
        orderId: order.id,
        tenantId: tenant.id,
        userDni: order.user?.dni || undefined,
        expiresAt: order.expiresAt.toISOString(),
      })

      // Actualizar estado atómicamente a ACTIVE
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'ACTIVE',
          mpPaymentId: String(paymentId),
          qrTokenHash: tokenHash,
        },
      })

      console.log(`[Webhook MP] Orden ${orderId} ACTIVADA exitosamente vía pago ${paymentId}`)
      return NextResponse.json({ status: 'order_activated', orderId }, { status: 200 })
    }

    if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          mpPaymentId: String(paymentId),
        },
      })
      return NextResponse.json({ status: 'order_cancelled', orderId }, { status: 200 })
    }

    return NextResponse.json({ status: 'pending_confirmation', orderId }, { status: 200 })
  } catch (error) {
    console.error('[Webhook MP] Error procesando notificación:', error)
    return NextResponse.json({ error: 'Error interno en webhook.' }, { status: 500 })
  }
}
