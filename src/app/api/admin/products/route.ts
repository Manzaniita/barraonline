import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createProduct,
  updateProductDetails,
  deleteProduct,
} from '@/lib/admin-service'
import { ADMIN_ROLES, requireApiRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/products?tenantSlug=...
 * Lista los productos de una tienda para gestión administrativa.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantSlug = searchParams.get('tenantSlug') || undefined

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    const effectiveSlug = tenantSlug || auth.user.tenantSlug
    if (!effectiveSlug) {
      return NextResponse.json(
        { success: false, error: 'Se requiere especificar tenantSlug.' },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: effectiveSlug },
      include: {
        products: {
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        },
      },
    })

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tienda no encontrada.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      products: tenant.products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        price: Number(p.price),
        imageUrl: p.imageUrl,
        stockAvailable: p.stockAvailable,
        redeemDeadlineTime: p.redeemDeadlineTime,
        isActive: p.isActive,
      })),
    })
  } catch (error: any) {
    console.error('[GET /api/admin/products] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al obtener productos.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/products
 * Crea un nuevo producto en la carta de la tienda.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      tenantSlug,
      name,
      category,
      description,
      price,
      stockAvailable,
      imageUrl,
      redeemDeadlineTime,
      isActive,
    } = body

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    const effectiveSlug = tenantSlug || auth.user.tenantSlug
    if (!effectiveSlug) {
      return NextResponse.json(
        { success: false, error: 'Se requiere especificar la tienda (tenantSlug).' },
        { status: 400 }
      )
    }

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre del producto es obligatorio.' },
        { status: 400 }
      )
    }

    if (price === undefined || Number(price) < 0) {
      return NextResponse.json(
        { success: false, error: 'El precio debe ser un número válido mayor o igual a 0.' },
        { status: 400 }
      )
    }

    const created = await createProduct({
      tenantSlug: effectiveSlug,
      name: String(name),
      category: category ? String(category) : 'Tragos',
      description: description !== undefined ? description : null,
      price: Number(price),
      stockAvailable: stockAvailable !== undefined ? Number(stockAvailable) : 100,
      imageUrl: imageUrl !== undefined ? imageUrl : null,
      redeemDeadlineTime: redeemDeadlineTime !== undefined ? redeemDeadlineTime : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    })

    return NextResponse.json({
      success: true,
      product: {
        ...created,
        price: Number(created.price),
      },
      message: `Producto "${created.name}" creado correctamente.`,
    })
  } catch (error: any) {
    console.error('[POST /api/admin/products] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al crear el producto.' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/products
 * Edita todos los campos de un producto existente.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      productId,
      tenantSlug,
      name,
      category,
      description,
      price,
      stockAvailable,
      imageUrl,
      redeemDeadlineTime,
      isActive,
    } = body

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId es obligatorio.' },
        { status: 400 }
      )
    }

    const updated = await updateProductDetails({
      productId,
      name,
      category,
      description,
      price: price !== undefined ? Number(price) : undefined,
      stockAvailable: stockAvailable !== undefined ? Number(stockAvailable) : undefined,
      imageUrl,
      redeemDeadlineTime,
      isActive,
    })

    return NextResponse.json({
      success: true,
      product: {
        ...updated,
        price: Number(updated.price),
      },
      message: `Producto "${updated.name}" actualizado.`,
    })
  } catch (error: any) {
    console.error('[PUT /api/admin/products] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al actualizar el producto.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/products
 * Elimina un producto de forma permanente.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let productId = searchParams.get('productId') || searchParams.get('id')
    let tenantSlug = searchParams.get('tenantSlug') || undefined

    if (!productId) {
      const body = await req.json().catch(() => ({}))
      productId = body.productId || body.id
      if (!tenantSlug && body.tenantSlug) tenantSlug = body.tenantSlug
    }

    const auth = await requireApiRole(req, ADMIN_ROLES, tenantSlug)
    if (auth.error) return auth.error

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere productId para eliminar el producto.' },
        { status: 400 }
      )
    }

    await deleteProduct({ productId })

    return NextResponse.json({
      success: true,
      message: 'Producto eliminado permanentemente.',
    })
  } catch (error: any) {
    console.error('[DELETE /api/admin/products] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al eliminar el producto.' },
      { status: 500 }
    )
  }
}
