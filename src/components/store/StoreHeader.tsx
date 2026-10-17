'use client'

import React, { useState, useEffect } from 'react'
import { ThemeConfig } from '@/lib/catalog-service'
import {
  CustomerProfile,
  getSavedCustomerProfile,
  saveCustomerProfile,
} from '@/lib/customer-session'
import { CustomerAuthModal } from './CustomerAuthModal'
import { GlassWater, UserCheck, UserPlus, QrCode, Wine, Settings } from 'lucide-react'
import Link from 'next/link'

interface StoreHeaderProps {
  theme: ThemeConfig
  tenantSlug: string
}

export function StoreHeader({ theme, tenantSlug }: StoreHeaderProps) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  useEffect(() => {
    const local = getSavedCustomerProfile()
    if (local) {
      setCustomer(local)
    }

    // Sincronizar sesión y rol en vivo con el servidor
    fetch(`/api/auth/me?userId=${local?.userId || ''}&dni=${local?.dni || ''}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          const synced: CustomerProfile = {
            userId: data.user.id,
            dni: data.user.dni || local?.dni || '',
            fullName: data.user.fullName || local?.fullName || 'Usuario',
            email: data.user.email || local?.email,
            phone: data.user.phone || local?.phone,
            role: data.user.role,
            tenantSlug: data.user.tenantSlug || tenantSlug,
            authProvider: data.user.authProvider,
            hasPassword: data.user.hasPassword,
          }
          saveCustomerProfile(synced)
          setCustomer(synced)
        }
      })
      .catch(() => {})
  }, [tenantSlug])

  return (
    <header className="sticky top-0 z-30 bg-[#0a0a0c]/85 backdrop-blur-md border-b border-white/10 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Marca del boliche */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20 shrink-0">
            <GlassWater className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm text-white leading-tight tracking-wide truncate">
              {theme.nightclubName}
            </h1>
            <p className="text-[11px] text-purple-400 font-medium truncate">
              {theme.tagline || 'Barra Rápida QR'}
            </p>
          </div>
        </div>

        {/* Acciones de usuario */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Si tiene rol de Bartender o Admin, mostrar botón rápido */}
          {customer?.role &&
            (customer.role === 'BARTENDER' ||
              customer.role === 'CLUB_ADMIN' ||
              customer.role === 'SUPER_ADMIN') && (
              <Link
                href={
                  customer.role === 'BARTENDER'
                    ? `/${tenantSlug}/barra`
                    : `/${tenantSlug}/admin`
                }
                className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 transition-colors flex items-center gap-1 text-xs font-bold"
                title="Panel de Personal"
              >
                {customer.role === 'BARTENDER' ? (
                  <Wine className="w-4 h-4 text-purple-400" />
                ) : (
                  <Settings className="w-4 h-4 text-pink-400" />
                )}
              </Link>
            )}

          {/* Botón Mis Tragos */}
          <Link
            href={`/${tenantSlug}/mis-tragos`}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
            title="Mis QRs y Saldo"
          >
            <QrCode className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline font-medium">Mis QR</span>
          </Link>

          {/* Botón de Mi Cuenta / Ingresar */}
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
              customer
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-200 hover:bg-purple-500/25'
                : 'bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            {customer ? (
              <>
                <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                <span className="max-w-[85px] truncate">
                  {customer.fullName.split(' ')[0]}
                </span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-purple-400" />
                <span>Mi Cuenta</span>
              </>
            )}
          </button>
        </div>
      </div>

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(profile) => setCustomer(profile)}
        tenantSlug={tenantSlug}
      />
    </header>
  )
}
