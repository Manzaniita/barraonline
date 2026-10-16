import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderQrToken } from '@/lib/crypto'
import { calculateExpirationDate } from '@/lib/mercadopago'

export async function POST(req: NextRequest) {
  try {
    const { orderId, tenantSlug, userDni } = await req.json()

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 })
    }

    const expiresAt = calculateExpirationDate('07:00').toISOString()
    const tenantId = `tenant-${tenantSlug || 'demo-club'}`

    // Generar el token QR real y firmado criptográficamente
    const { token, tokenHash } = generateOrderQrToken({
      orderId,
      tenantId,
      userDni: userDni || '42123456',
      expiresAt,
    })

    // Si la base de datos está disponible, actualizar orden
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'ACTIVE',
          mpPaymentId: `sim-pay-${Date.now()}`,
          qrTokenHash: tokenHash,
        },
      })
    } catch {}

    return NextResponse.json({
      success: true,
      status: 'ACTIVE',
      orderId,
      qrToken: token,
      tokenHash,
      expiresAt,
      message: 'Pago simulado aprobado exitosamente. Orden activada con QR firmado.',
    })
  } catch (error) {
    console.error('[simulate-payment] Error:', error)
    return NextResponse.json({ error: 'Error simulando pago' }, { status: 500 })
  }
}
