import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderQrToken } from '@/lib/crypto'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      tenant: { select: { slug: true, name: true } },
      user: { select: { fullName: true, dni: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  let qrToken: string | null = null
  if (order.status === 'ACTIVE') {
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
