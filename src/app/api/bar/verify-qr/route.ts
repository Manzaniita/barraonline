import { NextRequest, NextResponse } from 'next/server'
import { verifyQrForBar } from '@/lib/bar-service'
import { STAFF_ROLES, requireApiRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const { qrToken, tenantSlug } = await req.json()

    const auth = await requireApiRole(req, STAFF_ROLES, tenantSlug || 'demo-club')
    if (auth.error) return auth.error

    if (!qrToken || typeof qrToken !== 'string') {
      return NextResponse.json({ error: 'Token QR requerido.' }, { status: 400 })
    }

    const result = await verifyQrForBar({
      qrToken,
      tenantSlug: tenantSlug || 'demo-club',
    })

    if (!result.valid) {
      return NextResponse.json({ error: result.error || 'Código QR inválido' }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      order: result.order,
    })
  } catch (err) {
    console.error('[api/bar/verify-qr] Error:', err)
    return NextResponse.json({ error: 'Error verificando código QR.' }, { status: 500 })
  }
}
