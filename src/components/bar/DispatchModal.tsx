'use client'

import React, { useState } from 'react'
import { BarVerifiedOrder } from '@/lib/bar-service'
import { barAudio } from './BarAudioFeedback'
import {
  X,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wine,
  UserCheck,
  Zap,
} from 'lucide-react'

interface DispatchModalProps {
  order: BarVerifiedOrder
  qrToken: string
  tenantSlug: string
  onClose: () => void
  onSuccessRedeem: (redemptionLogIds: string[], totalDelivered: number) => void
}

export function DispatchModal({
  order,
  qrToken,
  tenantSlug,
  onClose,
  onSuccessRedeem,
}: DispatchModalProps) {
  // Estado local de cantidades a entregar por orderItemId
  const [quantitiesToDeliver, setQuantitiesToDeliver] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    order.items.forEach((item) => {
      // Por defecto sugerimos entregar todas las disponibles
      initial[item.orderItemId] = item.quantityAvailable
    })
    return initial
  })

  const [substitutions, setSubstitutions] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleQuantityChange = (orderItemId: string, delta: number, max: number) => {
    setQuantitiesToDeliver((prev) => {
      const current = prev[orderItemId] || 0
      const next = Math.max(0, Math.min(max, current + delta))
      return { ...prev, [orderItemId]: next }
    })
  }

  const handleSelectAll = () => {
    const next: Record<string, number> = {}
    order.items.forEach((item) => {
      next[item.orderItemId] = item.quantityAvailable
    })
    setQuantitiesToDeliver(next)
  }

  const handleClearAll = () => {
    const next: Record<string, number> = {}
    order.items.forEach((item) => {
      next[item.orderItemId] = 0
    })
    setQuantitiesToDeliver(next)
  }

  const totalDelivering = Object.values(quantitiesToDeliver).reduce((a, b) => a + b, 0)

  const handleConfirmRedeem = async () => {
    if (totalDelivering <= 0) {
      setError('Seleccioná al menos 1 bebida para entregar.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const deliveries = Object.entries(quantitiesToDeliver)
      .filter(([_, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({
        orderItemId,
        quantity,
      }))

    try {
      const res = await fetch('/api/bar/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken,
          tenantSlug,
          deliveries,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo confirmar la entrega.')
      }

      barAudio.playSuccess()
      onSuccessRedeem(data.redemptionLogIds || [], totalDelivering)
      onClose()
    } catch (err) {
      barAudio.playError()
      setError(err instanceof Error ? err.message : 'Error en la entrega')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-obsidian-surface border-2 border-purple-500/40 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white">
        {/* Cabecera del Cliente */}
        <div className="p-4 bg-gradient-to-r from-purple-900/40 via-purple-800/20 to-black border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white leading-tight">
                {order.customerName}
              </h3>
              <p className="text-xs text-white/60">
                DNI: <strong className="text-white">{order.customerDni}</strong> • Orden #{order.orderId.slice(0, 8)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Acciones Rápidas */}
        <div className="px-4 py-2.5 bg-black/40 border-b border-white/5 flex items-center justify-between text-xs">
          <span className="text-white/60">Bebidas disponibles en este QR</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="text-purple-400 hover:text-purple-300 font-bold active:scale-95"
            >
              Entregar Todo
            </button>
            <span className="text-white/20">•</span>
            <button
              onClick={handleClearAll}
              className="text-white/40 hover:text-white active:scale-95"
            >
              En Cero
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 mb-0 p-3 bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Lista de Bebidas */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {order.items.map((item) => {
            const delivering = quantitiesToDeliver[item.orderItemId] || 0
            const isOutOfStock = substitutions[item.orderItemId]

            return (
              <div
                key={item.orderItemId}
                className={`border rounded-2xl p-3.5 transition-all ${
                  item.quantityAvailable === 0
                    ? 'bg-black/30 border-white/5 opacity-50'
                    : delivering > 0
                    ? 'bg-purple-950/20 border-purple-500/40 shadow-lg shadow-purple-950/20'
                    : 'bg-obsidian-elevated border-obsidian-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                      <Wine className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>{item.name}</span>
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className="text-white/50">
                        Compradas: {item.quantityPurchased} • Ya entregadas: {item.quantityRedeemed}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                      item.quantityAvailable > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/10 text-white/40'
                    }`}>
                      {item.quantityAvailable} disponibles
                    </span>
                  </div>
                </div>

                {/* Controles Táctiles Gigantes de Despacho */}
                {item.quantityAvailable > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2">
                    <span className="text-xs text-white/60">Cantidad a entregar ahora:</span>
                    <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
                      <button
                        onClick={() => handleQuantityChange(item.orderItemId, -1, item.quantityAvailable)}
                        disabled={delivering === 0}
                        className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center font-bold text-lg active:scale-90 transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-extrabold text-base text-white">
                        {delivering}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.orderItemId, 1, item.quantityAvailable)}
                        disabled={delivering >= item.quantityAvailable}
                        className="w-9 h-9 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-30 text-white flex items-center justify-center font-bold text-lg active:scale-90 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Botón de Confirmación Gigante */}
        <div className="p-4 bg-obsidian-surface border-t border-obsidian-border space-y-2">
          <button
            onClick={handleConfirmRedeem}
            disabled={totalDelivering === 0 || isSubmitting}
            className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:opacity-95 disabled:opacity-40 text-black font-black py-4 rounded-2xl shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2.5 text-base active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {isSubmitting
                ? 'CONFIRMANDO EN BASE DE DATOS...'
                : totalDelivering > 0
                ? `CONFIRMAR ENTREGA (${totalDelivering} ${totalDelivering === 1 ? 'TRAGO' : 'TRAGOS'})`
                : 'SELECCIONÁ BEBIDAS PARA ENTREGAR'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
