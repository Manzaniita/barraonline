import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderQrToken } from '@/lib/crypto'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const { searchParams } = new URL(req.url)
  const isDemoParam = searchParams.get('demo') === 'true'

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      tenant: { select: { slug: true, name: true, mpAccessTokenEnc: true } },
      user: { select: { fullName: true, dni: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  // Si la orden está en PENDING pero viene de navegación demo o el boliche no tiene credenciales de Mercado Pago,
  // se activa automáticamente para permitir la emisión del ticket QR en barra.
  if (order.status === 'PENDING' && (isDemoParam || !order.tenant?.mpAccessTokenEnc)) {
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'ACTIVE' },
      })
      order.status = 'ACTIVE'
    } catch (updateErr) {
      console.warn('[customer/orders] Advertencia al activar orden demo:', updateErr)
    }
  }

  let qrToken: string | null = null
  if (order.status === 'ACTIVE' || isDemoParam) {
    const tokenResult = generateOrderQrToken({
      orderId: order.id,
      tenantId: order.tenantId,
      userDni: order.user?.dni || undefined,
      expiresAt: order.expiresAt
        ? order.expiresAt.toISOString()
        : new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
    })
    qrToken = tokenResult.token
  }

  return NextResponse.json({ order, qrToken })
}
