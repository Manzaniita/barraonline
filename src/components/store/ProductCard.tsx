// src/components/store/ProductCard.tsx
'use client'

import React, { useMemo } from 'react'
import { StoreProduct } from '@/lib/catalog-service'
import { useCart } from '@/context/CartContext'
import { APP_CONFIG } from '@/config/constants'
import { Plus, Minus, Clock, Wine, Beer, Sparkles, Droplets } from 'lucide-react'

export function ProductCard({ product }: { product: StoreProduct }) {
  const { items, addItem, updateQuantity } = useCart()
  const cartItem = items.find((i) => i.product.id === product.id)
  const quantity = cartItem?.quantity || 0

  const formattedPrice = useMemo(() => {
    return new Intl.NumberFormat(APP_CONFIG.currency.locale, {
      style: 'currency',
      currency: APP_CONFIG.currency.code,
      maximumFractionDigits: APP_CONFIG.currency.maximumFractionDigits,
    }).format(product.price)
  }, [product.price])

  const categoryMeta = useMemo(() => {
    const key = product.category.toLowerCase().replace(/\s+/g, '_') as keyof typeof APP_CONFIG.categories
    return (
      APP_CONFIG.categories[key] || {
        label: product.category,
        iconName: 'Wine',
        color: 'text-purple-400',
        glow: 'shadow-purple-500/20',
      }
    )
  }, [product.category])

  const CategoryIcon = useMemo(() => {
    switch (categoryMeta.iconName) {
      case 'Beer':
        return Beer
      case 'Sparkles':
        return Sparkles
      case 'Droplets':
        return Droplets
      default:
        return Wine
    }
  }, [categoryMeta.iconName])

  return (
    <div className="glass-panel glass-panel-interactive rounded-2xl p-4 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] font-medium tracking-wide ${categoryMeta.color}`}
          >
            <CategoryIcon className="w-3.5 h-3.5" />
            {categoryMeta.label}
          </span>

          {product.redeemDeadlineTime && (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-semibold">
              <Clock className="w-3 h-3 animate-spin [animation-duration:12s]" />
              <span>Hasta {product.redeemDeadlineTime}</span>
            </div>
          )}
        </div>

        <h3 className="font-bold text-white text-base leading-snug mb-1 group-hover:text-purple-300 transition-colors">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-4">
            {product.description}
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3 mt-auto">
        <span className="font-extrabold text-lg text-white tracking-tight">
          {formattedPrice}
        </span>

        {quantity === 0 ? (
          <button
            onClick={() => addItem(product)}
            className="min-h-[44px] px-4 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-purple-600/20 active:scale-90 transition-transform cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-white/10 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => updateQuantity(product.id, quantity - 1)}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white active:scale-75 transition-transform"
              aria-label="Restar unidad"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-bold text-white min-w-[20px] text-center font-mono">
              {quantity}
            </span>
            <button
              onClick={() => updateQuantity(product.id, quantity + 1)}
              className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white active:scale-75 transition-transform"
              aria-label="Sumar unidad"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
