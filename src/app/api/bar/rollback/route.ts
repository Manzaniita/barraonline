import { NextRequest, NextResponse } from 'next/server'
import { rollbackRecentRedemption } from '@/lib/bar-service'
import { STAFF_ROLES, requireApiRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole(req, STAFF_ROLES)
    if (auth.error) return auth.error

    const { redemptionLogIds } = await req.json()

    if (!redemptionLogIds || !Array.isArray(redemptionLogIds) || redemptionLogIds.length === 0) {
      return NextResponse.json(
        { error: 'IDs de entregas requeridos para revertir.' },
        { status: 400 }
      )
    }

    const result = await rollbackRecentRedemption({
      redemptionLogIds,
      bartenderUserId: auth.user.id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'No se pudo revertir la entrega.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Entrega deshecha exitosamente. Saldo restaurado.',
    })
  } catch (err) {
    console.error('[api/bar/rollback] Error:', err)
    return NextResponse.json({ error: 'Error procesando reversión.' }, { status: 500 })
  }
}
