'use client'

import React, { useState, useEffect } from 'react'
import {
  CustomerProfile,
  getSavedCustomerProfile,
  saveCustomerProfile,
  isValidDni,
  isValidFullName,
} from '@/lib/customer-session'
import { ShieldCheck, User, Phone, IdCard, X } from 'lucide-react'

interface CustomerAuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (profile: CustomerProfile) => void
  requiredNotice?: string
}

export function CustomerAuthModal({
  isOpen,
  onClose,
  onSuccess,
  requiredNotice,
}: CustomerAuthModalProps) {
  const [dni, setDni] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      const existing = getSavedCustomerProfile()
      if (existing) {
        setDni(existing.dni)
        setFullName(existing.fullName)
        setPhone(existing.phone || '')
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanDni = dni.replace(/\D/g, '')

    if (!isValidDni(cleanDni)) {
      setError('Por favor ingresá un DNI válido (entre 7 y 9 dígitos).')
      return
    }

    if (!isValidFullName(fullName)) {
      setError('Ingresá tu nombre y apellido completo.')
      return
    }

    const profile: CustomerProfile = {
      dni: cleanDni,
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
    }

    saveCustomerProfile(profile)
    onSuccess(profile)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121218] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">Identificación Rápida</h3>
            <p className="text-xs text-white/60">Único paso de 5 segundos para tu pedido</p>
          </div>
        </div>

        {requiredNotice && (
          <div className="mb-4 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
            {requiredNotice}
          </div>
        )}

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              DNI del Comprador <span className="text-purple-400">*</span>
            </label>
            <div className="relative">
              <IdCard className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                inputMode="numeric"
                required
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 42123456"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              />
            </div>
            <span className="text-[10px] text-white/40 mt-0.5 block">
              Será el DNI asociado a tu código QR para el canje.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              Nombre y Apellido <span className="text-purple-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              WhatsApp / Teléfono <span className="text-white/40">(opcional)</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 11 9876 5432"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-purple-600/30 active:scale-[0.98] transition-all"
          >
            Confirmar e Identificarme
          </button>
        </form>

        <p className="text-[11px] text-center text-white/40 mt-4">
          Tus datos quedarán guardados en tu dispositivo por 90 días para que no tengas que volver a ingresarlos.
        </p>
      </div>
    </div>
  )
}
