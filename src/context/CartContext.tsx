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
}: {
  children: React.ReactNode
  tenantSlug: string
}) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const storageKey = `barraonline_cart_${tenantSlug}`

  // Cargar carrito desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setItems(JSON.parse(saved))
      }
    } catch {
      // Ignorar errores de parsing
    } finally {
      setIsLoaded(true)
    }
  }, [storageKey])

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
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
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
      prev.map((i) =>
        i.product.id === productId ? { ...i, quantity } : i
      )
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
