'use client'

import React, { useState, useEffect } from 'react'
import { RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react'

interface RollbackBannerProps {
  redemptionLogIds: string[]
  itemsDeliveredCount: number
  onRollbackComplete: () => void
  onDismiss: () => void
}

export function RollbackBanner({
  redemptionLogIds,
  itemsDeliveredCount,
  onRollbackComplete,
  onDismiss,
}: RollbackBannerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(60)
  const [isReverting, setIsReverting] = useState(false)
  const [reverted, setReverted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onDismiss()
      return
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [secondsRemaining, onDismiss])

  const handleRollback = async () => {
    setIsReverting(true)
    setError(null)

    try {
      const res = await fetch('/api/bar/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redemptionLogIds }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo revertir la entrega.')
      }

      setReverted(true)
      setTimeout(() => {
        onRollbackComplete()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al revertir')
      setIsReverting(false)
    }
  }

  return (
    <div className="fixed top-4 inset-x-4 z-50 max-w-md mx-auto animate-in slide-in-from-top-4 duration-300">
      <div className="bg-[#1c1815] border-2 border-amber-500/60 rounded-2xl p-3.5 shadow-2xl shadow-amber-950/80 text-white flex items-center justify-between gap-3">
        {reverted ? (
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold w-full justify-center py-1">
            <CheckCircle className="w-4 h-4" />
            <span>Entrega deshecha. El saldo del cliente fue restaurado.</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  Entrega de {itemsDeliveredCount} {itemsDeliveredCount === 1 ? 'bebida' : 'bebidas'} realizada
                </p>
                <p className="text-[11px] text-amber-300/80">
                  ¿Error de tipeo? Deshacer disponible por {secondsRemaining}s
                </p>
              </div>
            </div>

            <button
              onClick={handleRollback}
              disabled={isReverting}
              className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0 active:scale-95 transition-all shadow-md"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isReverting ? 'animate-spin' : ''}`} />
              <span>{isReverting ? 'Revertiendo...' : `Deshacer (${secondsRemaining}s)`}</span>
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mt-1.5 p-2 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-xs text-center font-medium">
          {error}
        </div>
      )}
    </div>
  )
}
