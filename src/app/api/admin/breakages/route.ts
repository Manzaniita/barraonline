import { NextRequest, NextResponse } from 'next/server'
import { recordBreakage } from '@/lib/admin-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tenantSlug, productId, quantity, reason, notes, costEstimate, bartenderUserId } = body

    if (!tenantSlug || !productId || !quantity || !reason) {
      return NextResponse.json(
        { success: false, error: 'tenantSlug, productId, quantity y reason son obligatorios' },
        { status: 400 }
      )
    }

    const breakage = await recordBreakage({
      tenantSlug,
      productId,
      quantity: Number(quantity),
      reason,
      notes,
      costEstimate: costEstimate ? Number(costEstimate) : undefined,
      bartenderUserId,
    })

    return NextResponse.json({
      success: true,
      breakage,
    })
  } catch (error: any) {
    console.error('Error recording breakage:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error registrando rotura' },
      { status: 500 }
    )
  }
}
