import { NextRequest, NextResponse } from 'next/server'
import { toggleProductStatus, updateProductDetails } from '@/lib/admin-service'
import { ADMIN_ROLES, requireApiRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      productId,
      tenantSlug,
      isActive,
      name,
      category,
      description,
      price,
      stockAvailable,
      imageUrl,
      redeemDeadlineTime,
    } = body

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId es requerido' },
        { status: 400 }
      )
    }

    const effectiveSlug = auth.user.role === 'SUPER_ADMIN' ? tenantSlug : auth.user.tenantSlug
    if (auth.user.role !== 'SUPER_ADMIN' && !effectiveSlug) {
      return NextResponse.json({ success: false, error: 'Acceso denegado.' }, { status: 403 })
    }

    let updatedProduct
    if (typeof isActive === 'boolean' && name === undefined && price === undefined && stockAvailable === undefined) {
      updatedProduct = await toggleProductStatus({ productId, isActive, tenantSlug: effectiveSlug })
    } else {
      updatedProduct = await updateProductDetails({
        productId,
        tenantSlug: effectiveSlug,
        name,
        category,
        description,
        price: price !== undefined ? Number(price) : undefined,
        stockAvailable: stockAvailable !== undefined ? Number(stockAvailable) : undefined,
        imageUrl,
        redeemDeadlineTime,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      })
    }

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    })
  } catch (error: any) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { success: false, error: 'Error actualizando producto' },
      { status: 500 }
    )
  }
}
