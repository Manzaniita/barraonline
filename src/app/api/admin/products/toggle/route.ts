import { NextRequest, NextResponse } from 'next/server'
import { toggleProductStatus, updateProductDetails } from '@/lib/admin-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, isActive, price, stockAvailable } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId es requerido' },
        { status: 400 }
      )
    }

    let updatedProduct
    if (typeof isActive === 'boolean') {
      updatedProduct = await toggleProductStatus({ productId, isActive })
    }

    if (price !== undefined || stockAvailable !== undefined) {
      updatedProduct = await updateProductDetails({
        productId,
        price: price !== undefined ? Number(price) : undefined,
        stockAvailable: stockAvailable !== undefined ? Number(stockAvailable) : undefined,
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
