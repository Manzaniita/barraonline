'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CustomerProfile,
  getSavedCustomerProfile,
  saveCustomerProfile,
  clearCustomerProfile,
} from '@/lib/customer-session'
import { CustomerAuthModal } from '@/components/store/CustomerAuthModal'
import { ShieldAlert, Lock, UserCheck, ArrowLeft, LogIn, RefreshCw } from 'lucide-react'

interface RoleGuardProps {
  allowedRoles: Array<'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'>
  sectionTitle: string
  tenantSlug?: string
  children: React.ReactNode
}

export function RoleGuard({
  allowedRoles,
  sectionTitle,
  tenantSlug = 'demo-club',
  children,
}: RoleGuardProps) {
  const [user, setUser] = useState<CustomerProfile | null>(null)
  const [checking, setChecking] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const verifyCurrentSession = async () => {
    setChecking(true)
    const saved = getSavedCustomerProfile()
    try {
      const res = await fetch(
        `/api/auth/me?userId=${saved?.userId || ''}&dni=${saved?.dni || ''}`,
        { cache: 'no-store' }
      )
      const data = await res.json()
      if (data.success && data.user) {
        const synced: CustomerProfile = {
          userId: data.user.id,
          fullName: data.user.fullName || saved?.fullName || 'Usuario',
          dni: data.user.dni || saved?.dni || '',
          email: data.user.email || saved?.email,
          phone: data.user.phone || saved?.phone,
          role: data.user.role,
          tenantSlug: data.user.tenantSlug || tenantSlug,
          authProvider: data.user.authProvider,
          hasPassword: data.user.hasPassword,
        }
        saveCustomerProfile(synced)
        setUser(synced)
      } else if (saved) {
        setUser(saved)
      } else {
        setUser(null)
      }
    } catch {
      if (saved) setUser(saved)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    verifyCurrentSession()
  }, [tenantSlug])

  if (checking) {
    return (
      <div className="min-h-screen bg-[#07070b] text-white flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-4 border-t-purple-500 border-purple-950 animate-spin mb-3" />
        <p className="text-xs font-mono uppercase tracking-widest text-gray-400">
          Verificando cuenta y permisos...
        </p>
      </div>
    )
  }

  const hasPermission = user?.role && allowedRoles.includes(user.role)

  if (hasPermission) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex flex-col items-center justify-center p-4">
      <div className="bg-[#12121a] border border-purple-500/30 rounded-3xl max-w-md w-full p-7 text-center shadow-2xl space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-400">
          {user ? <ShieldAlert className="w-8 h-8 text-rose-400" /> : <Lock className="w-8 h-8" />}
        </div>

        <div>
          <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
            Acceso por Rol • {sectionTitle}
          </span>
          <h1 className="text-2xl font-black text-white mt-3">
            {user ? 'Permisos Insuficientes' : 'Iniciá Sesión con tu Cuenta'}
          </h1>
          <p className="text-sm text-white/60 mt-2 leading-relaxed">
            {user ? (
              <>
                Estás conectado como <b className="text-white">{user.fullName}</b> con rol{' '}
                <span className="text-amber-300 font-mono font-bold">
                  {user.role || 'CUSTOMER'}
                </span>
                . Esta sección requiere rol{' '}
                <b className="text-purple-300">{allowedRoles.join(' o ')}</b> asignado desde el
                panel de administración.
              </>
            ) : (
              <>
                Para ingresar a <b>{sectionTitle}</b>, iniciá sesión con tu cuenta autorizada
                (Google, Apple, correo electrónico, teléfono o DNI).
              </>
            )}
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-purple-900/40 flex items-center justify-center gap-2 transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>{user ? 'Cambiar de Cuenta / Gestionar Mi Cuenta' : 'Iniciar Sesión / Crear Cuenta'}</span>
          </button>

          {user && (
            <button
              onClick={verifyCurrentSession}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ya me asignaron el rol, volver a verificar</span>
            </button>
          )}

          <Link
            href={`/${tenantSlug}`}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white/50 hover:text-white flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a la Carta de Tragos</span>
          </Link>
        </div>
      </div>

      <CustomerAuthModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(profile) => {
          setUser(profile)
          verifyCurrentSession()
        }}
        tenantSlug={tenantSlug}
      />
    </div>
  )
}
