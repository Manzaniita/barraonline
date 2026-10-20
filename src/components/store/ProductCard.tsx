'use client'

import React, { useMemo } from 'react'
import { StoreProduct } from '@/lib/catalog-service'
import { useCart } from '@/context/CartContext'
import { APP_CONFIG } from '@/config/constants'
import { Plus, Minus, Clock, Wine, Beer, Sparkles, Droplets } from 'lucide-react'

export function ProductCard({
  product,
  primaryColor,
}: {
  product: StoreProduct
  primaryColor?: string
}) {
  const { items, addItem, updateQuantity } = useCart()
  const cartItem = items.find((i) => i.product.id === product.id)
  const quantity = cartItem?.quantity || 0
  const isOutOfStock = product.stockAvailable <= 0
  const reachedMaxStock = quantity >= product.stockAvailable

  const formattedPrice = useMemo(() => {
    return new Intl.NumberFormat(APP_CONFIG.currency.locale, {
      style: 'currency',
      currency: APP_CONFIG.currency.code,
      maximumFractionDigits: APP_CONFIG.currency.maximumFractionDigits,
    }).format(product.price)
  }, [product.price])

  // Respetar siempre el nombre exacto de la categoría configurada en el producto
  const categoryStyle = useMemo(() => {
    const lower = (product.category || '').toLowerCase()
    if (lower.includes('cerveza') || lower.includes('birra')) {
      return { Icon: Beer, color: 'text-amber-400' }
    }
    if (lower.includes('combo') || lower.includes('botella') || lower.includes('vip')) {
      return { Icon: Sparkles, color: 'text-pink-400' }
    }
    if (lower.includes('agua') || lower.includes('sin alcohol') || lower.includes('energ')) {
      return { Icon: Droplets, color: 'text-cyan-400' }
    }
    return { Icon: Wine, color: 'text-purple-400' }
  }, [product.category])

  const CategoryIcon = categoryStyle.Icon

  return (
    <div className="glass-panel glass-panel-interactive rounded-2xl p-4 flex flex-col justify-between group">
      <div className="flex gap-3">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium tracking-wide ${categoryStyle.color}`}
            >
              <CategoryIcon className="w-3.5 h-3.5" />
              {product.category}
            </span>

            {product.redeemDeadlineTime && (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-semibold">
                <Clock className="w-3 h-3" />
                <span>Hasta {product.redeemDeadlineTime}</span>
              </div>
            )}
          </div>

          <h3 className="font-bold text-white text-base leading-snug mb-1 group-hover:text-purple-300 transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-white/50 line-clamp-2 leading-relaxed mb-3">
              {product.description}
            </p>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3 mt-auto">
        <div>
          <span className="font-extrabold text-lg text-white tracking-tight block">
            {formattedPrice}
          </span>
          {product.stockAvailable <= 15 && product.stockAvailable > 0 && (
            <span className="text-[10px] text-amber-400 font-medium">
              Quedan {product.stockAvailable} disp.
            </span>
          )}
        </div>

        {isOutOfStock ? (
          <span className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 font-bold text-xs">
            Sin Stock
          </span>
        ) : quantity === 0 ? (
          <button
            onClick={() => addItem(product)}
            style={primaryColor ? { backgroundColor: primaryColor } : undefined}
            className="min-h-[42px] px-4 rounded-xl bg-purple-600 hover:opacity-90 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-purple-600/20 active:scale-90 transition-transform cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-white/10 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => updateQuantity(product.id, quantity - 1)}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white active:scale-75 transition-transform cursor-pointer"
              aria-label="Restar unidad"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-bold text-white min-w-[20px] text-center font-mono">
              {quantity}
            </span>
            <button
              onClick={() => updateQuantity(product.id, quantity + 1)}
              disabled={reachedMaxStock}
              style={primaryColor ? { backgroundColor: primaryColor } : undefined}
              className="w-8 h-8 rounded-lg bg-purple-600 disabled:opacity-40 flex items-center justify-center text-white active:scale-75 transition-transform cursor-pointer"
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
