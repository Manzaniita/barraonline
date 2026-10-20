import { NextRequest, NextResponse } from 'next/server'
import { toggleProductStatus, updateProductDetails } from '@/lib/admin-service'
import { ADMIN_ROLES, requireApiRole } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole(req, ADMIN_ROLES)
    if (auth.error) return auth.error

    const body = await req.json()
    const {
      productId,
      isActive,
      name,
      category,
      description,
      price,
      stockAvailable,
      imageUrl,
      redeemDeadlineTime,
    } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId es requerido' },
        { status: 400 }
      )
    }

    let updatedProduct
    if (typeof isActive === 'boolean' && name === undefined && price === undefined && stockAvailable === undefined) {
      updatedProduct = await toggleProductStatus({ productId, isActive })
    } else {
      updatedProduct = await updateProductDetails({
        productId,
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
      { success: false, error: error?.message || 'Error actualizando producto' },
      { status: 500 }
    )
  }
}
