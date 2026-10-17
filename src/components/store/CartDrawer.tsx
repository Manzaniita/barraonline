'use client'

import React, { useState, useEffect } from 'react'
import { useCart } from '@/context/CartContext'
import { CustomerProfile, getSavedCustomerProfile } from '@/lib/customer-session'
import { CustomerAuthModal } from './CustomerAuthModal'
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  QrCode,
  Sparkles,
} from 'lucide-react'

interface CartDrawerProps {
  tenantSlug: string
  nightclubName: string
}

export function CartDrawer({ tenantSlug, nightclubName }: CartDrawerProps) {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    clearCart,
    totalAmount,
    totalCount,
  } = useCart()

  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null)

  useEffect(() => {
    if (isCartOpen) {
      setCustomer(getSavedCustomerProfile())
    }
  }, [isCartOpen])

  if (!isCartOpen) return null

  const formattedTotal = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(totalAmount)

  const handleCheckoutClick = async () => {
    // Si el usuario aún no inició sesión, abrir selector de cuenta
    if (!customer) {
      setIsAuthModalOpen(true)
      return
    }

    setIsProcessing(true)
    setCheckoutNotice(null)

    try {
      const response = await fetch('/api/checkout/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          customer,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'No se pudo generar la preferencia de pago.')
      }

      // Vaciar carrito al iniciar el pago y redirigir
      clearCart()
      setIsCartOpen(false)

      if (data.initPoint) {
        window.location.href = data.initPoint
      }
    } catch (err) {
      console.error('Error al iniciar checkout:', err)
      setCheckoutNotice(
        err instanceof Error ? err.message : 'Error al conectar con la pasarela de pago.'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0e0e13] border-l border-white/10 w-full max-w-md h-full flex flex-col justify-between text-white shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Cabecera del Carrito */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-base text-white flex items-center gap-2">
              <span>Tu Pedido</span>
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-semibold">
                {totalCount} {totalCount === 1 ? 'ítem' : 'ítems'}
              </span>
            </h2>
            <p className="text-xs text-white/50">{nightclubName}</p>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="p-2 text-white/40 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors text-xs flex items-center gap-1"
                title="Vaciar carrito"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lista de Ítems */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/50">
              <Sparkles className="w-12 h-12 text-purple-400/50 mb-3" />
              <p className="text-sm font-medium text-white/70">Tu carrito está vacío</p>
              <p className="text-xs mt-1 text-white/40">Elegí tus tragos de la carta para empezar.</p>
            </div>
          ) : (
            items.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="bg-[#15151e] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-white truncate">
                    {product.name}
                  </h4>
                  <span className="text-xs text-purple-400 font-semibold block mt-0.5">
                    {new Intl.NumberFormat('es-AR', {
                      style: 'currency',
                      currency: 'ARS',
                      maximumFractionDigits: 0,
                    }).format(product.price * quantity)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white text-xs active:scale-90"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold text-xs w-4 text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-purple-600 text-white text-xs active:scale-90"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(product.id)}
                    className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sección Inferior: Identificación y Checkout */}
        {items.length > 0 && (
          <div className="p-4 bg-[#121219] border-t border-white/10 space-y-3.5">
            {/* Estado de Identificación del Comprador */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              {customer ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">
                        {customer.fullName}
                      </p>
                      <p className="text-[11px] text-white/60">
                        DNI: {customer.dni} {customer.phone ? `• ${customer.phone}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="text-[11px] text-purple-400 hover:text-purple-300 font-medium underline"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-xs">Identificación requerida para el QR</span>
                  </div>
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-200 rounded-lg text-xs font-bold active:scale-95"
                  >
                    Completar DNI
                  </button>
                </div>
              )}
            </div>

            {/* Aviso informativo de prueba */}
            {checkoutNotice && (
              <div className="p-3 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-200 text-xs leading-relaxed animate-in fade-in">
                {checkoutNotice}
              </div>
            )}

            {/* Total y Botón de Pago */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Total a Pagar</span>
                <span className="text-xl font-extrabold text-white tracking-tight">
                  {formattedTotal}
                </span>
              </div>

              <button
                onClick={handleCheckoutClick}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-95 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Preparando orden...'
                    : customer
                    ? 'Pagar con Mercado Pago'
                    : 'Completar DNI y Pagar'}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/40 text-center">
              <QrCode className="w-3.5 h-3.5 text-purple-400" />
              <span>El código QR se descarga en fotos para canje sin internet</span>
            </div>
          </div>
        )}
      </div>
    </div>

    <CustomerAuthModal
      isOpen={isAuthModalOpen}
      onClose={() => setIsAuthModalOpen(false)}
      onSuccess={(profile) => setCustomer(profile)}
      requiredNotice="Para generar el código QR de canje en barra, necesitamos tu DNI una sola vez."
    />
  </>
)
}
