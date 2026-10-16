'use client'

import React from 'react'
import { useCart } from '@/context/CartContext'
import { ShoppingBag, ArrowRight } from 'lucide-react'

export function FloatingCartBar() {
  const { totalCount, totalAmount, setIsCartOpen } = useCart()

  if (totalCount === 0) return null

  const formattedTotal = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(totalAmount)

  return (
    <div className="fixed bottom-4 inset-x-4 z-40 max-w-md mx-auto animate-in slide-in-from-bottom-6 duration-300">
      <button
        onClick={() => setIsCartOpen(true)}
        className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 p-3.5 rounded-2xl shadow-2xl shadow-purple-900/60 flex items-center justify-between text-white active:scale-[0.98] transition-all border border-white/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black/30 backdrop-blur-md flex items-center justify-center font-extrabold text-sm border border-white/10">
            <ShoppingBag className="w-5 h-5 text-purple-200" />
          </div>
          <div className="text-left">
            <span className="text-xs text-purple-200 font-medium block">
              {totalCount} {totalCount === 1 ? 'bebida' : 'bebidas'} seleccionadas
            </span>
            <span className="text-base font-extrabold tracking-tight">
              {formattedTotal}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-black/30 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/10">
          <span>Ver Pedido</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </button>
    </div>
  )
}
