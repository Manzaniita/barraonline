'use client'

import React from 'react'
import { StoreProduct } from '@/lib/catalog-service'
import { useCart } from '@/context/CartContext'
import { Plus, Minus, Clock, Wine, Beer, Sparkles, Droplets } from 'lucide-react'

interface ProductCardProps {
  product: StoreProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const { items, addItem, updateQuantity } = useCart()

  const cartItem = items.find((i) => i.product.id === product.id)
  const quantity = cartItem ? cartItem.quantity : 0

  // Formateador de moneda argentina
  const formattedPrice = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(product.price)

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'tragos':
        return <Wine className="w-4 h-4 text-purple-400" />
      case 'cervezas':
        return <Beer className="w-4 h-4 text-amber-400" />
      case 'combos':
        return <Sparkles className="w-4 h-4 text-pink-400" />
      case 'sin alcohol':
        return <Droplets className="w-4 h-4 text-cyan-400" />
      default:
        return <Wine className="w-4 h-4 text-purple-400" />
    }
  }

  return (
    <div className="bg-[#121218] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all hover:border-white/20">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 text-[11px] text-white/70 font-medium border border-white/5">
            {getCategoryIcon(product.category)}
            <span>{product.category}</span>
          </div>

          {/* Badge de Horario Límite si es Promo */}
          {product.redeemDeadlineTime && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 font-semibold animate-pulse">
              <Clock className="w-3 h-3" />
              <span>Antes de las {product.redeemDeadlineTime}</span>
            </div>
          )}
        </div>

        <h3 className="font-bold text-white text-base leading-snug mb-1">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-xs text-white/60 line-clamp-2 mb-3 leading-relaxed">
            {product.description}
          </p>
        )}
      </div>

      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 mt-auto">
        <span className="font-extrabold text-white text-base tracking-tight">
          {formattedPrice}
        </span>

        {quantity === 0 ? (
          <button
            onClick={() => addItem(product)}
            className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-md shadow-purple-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-white/10 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => updateQuantity(product.id, quantity - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white active:scale-90 transition-all"
              aria-label="Restar unidad"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-bold text-white text-xs w-4 text-center">
              {quantity}
            </span>
            <button
              onClick={() => updateQuantity(product.id, quantity + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white active:scale-90 transition-all"
              aria-label="Sumar unidad"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
