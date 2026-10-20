'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { StoreProduct } from '@/lib/catalog-service'

export interface CartItem {
  product: StoreProduct
  quantity: number
}

interface CartContextType {
  items: CartItem[]
  addItem: (product: StoreProduct) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  totalAmount: number
  totalCount: number
  isCartOpen: boolean
  setIsCartOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({
  children,
  tenantSlug,
  catalogProducts,
}: {
  children: React.ReactNode
  tenantSlug: string
  catalogProducts?: StoreProduct[]
}) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const storageKey = `barraonline_cart_${tenantSlug}`

  // Cargar carrito desde localStorage al montar y reconciliar con el catálogo real del servidor
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed: CartItem[] = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          if (catalogProducts) {
            const productMap = new Map(catalogProducts.map((p) => [p.id, p]))
            const reconciled: CartItem[] = []
            for (const item of parsed) {
              const liveProduct = productMap.get(item?.product?.id)
              if (liveProduct && liveProduct.isActive && liveProduct.stockAvailable > 0) {
                const validQty = Math.min(Math.max(1, item.quantity || 1), liveProduct.stockAvailable)
                reconciled.push({
                  product: liveProduct,
                  quantity: validQty,
                })
              }
            }
            setItems(reconciled)
          } else {
            setItems(parsed)
          }
        }
      }
    } catch {
      // Ignorar errores de parsing
    } finally {
      setIsLoaded(true)
    }
  }, [storageKey, catalogProducts])

  // Guardar carrito al actualizar
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch {
      // Ignorar quota errors
    }
  }, [items, storageKey, isLoaded])

  const addItem = (product: StoreProduct) => {
    if (!product.isActive || product.stockAvailable <= 0) return
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stockAvailable) return prev
        return prev.map((i) =>
          i.product.id === product.id
            ? { product, quantity: Math.min(i.quantity + 1, product.stockAvailable) }
            : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.product.id !== productId) return i
        const maxStock = i.product.stockAvailable ?? 9999
        return { ...i, quantity: Math.min(quantity, maxStock) }
      })
    )
  }

  const clearCart = () => {
    setItems([])
    try {
      localStorage.removeItem(storageKey)
    } catch {}
  }

  const totalAmount = items.reduce(
    (acc, curr) => acc + curr.product.price * curr.quantity,
    0
  )

  const totalCount = items.reduce((acc, curr) => acc + curr.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalAmount,
        totalCount,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart debe ser utilizado dentro de un CartProvider')
  }
  return context
}
