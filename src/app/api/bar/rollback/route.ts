import { NextRequest, NextResponse } from 'next/server'
import { rollbackRecentRedemption } from '@/lib/bar-service'

export async function POST(req: NextRequest) {
  try {
    const { redemptionLogIds, bartenderUserId } = await req.json()

    if (!redemptionLogIds || !Array.isArray(redemptionLogIds) || redemptionLogIds.length === 0) {
      return NextResponse.json(
        { error: 'IDs de entregas requeridos para revertir.' },
        { status: 400 }
      )
    }

    const result = await rollbackRecentRedemption({
      redemptionLogIds,
      bartenderUserId,
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
