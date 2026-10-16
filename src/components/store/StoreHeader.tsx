'use client'

import React, { useState, useEffect } from 'react'
import { ThemeConfig } from '@/lib/catalog-service'
import { CustomerProfile, getSavedCustomerProfile } from '@/lib/customer-session'
import { CustomerAuthModal } from './CustomerAuthModal'
import { GlassWater, UserCheck, UserPlus, QrCode } from 'lucide-react'
import Link from 'next/link'

interface StoreHeaderProps {
  theme: ThemeConfig
  tenantSlug: string
}

export function StoreHeader({ theme, tenantSlug }: StoreHeaderProps) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  useEffect(() => {
    setCustomer(getSavedCustomerProfile())
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-[#0a0a0c]/85 backdrop-blur-md border-b border-white/10 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        {/* Marca del boliche */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20 shrink-0">
            <GlassWater className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-white leading-tight tracking-wide">
              {theme.nightclubName}
            </h1>
            <p className="text-[11px] text-purple-400 font-medium">
              {theme.tagline || 'Barra Rápida QR'}
            </p>
          </div>
        </div>

        {/* Acciones de usuario */}
        <div className="flex items-center gap-2">
          {/* Botón Mis Tragos */}
          <Link
            href={`/${tenantSlug}/mis-tragos`}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
            title="Mis QRs y Saldo"
          >
            <QrCode className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline font-medium">Mis QR</span>
          </Link>

          {/* Botón de Perfil / DNI */}
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              customer
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
            }`}
          >
            {customer ? (
              <>
                <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                <span className="max-w-[75px] truncate">DNI {customer.dni}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Identificarme</span>
              </>
            )}
          </button>
        </div>
      </div>

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(profile) => setCustomer(profile)}
      />
    </header>
  )
}
