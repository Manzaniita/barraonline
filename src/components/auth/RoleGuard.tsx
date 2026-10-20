'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  CustomerProfile,
  saveCustomerProfile,
  clearCustomerProfile,
} from '@/lib/customer-session'

interface RoleGuardProps {
  allowedRoles: Array<'CUSTOMER' | 'BARTENDER' | 'CLUB_ADMIN' | 'SUPER_ADMIN'>
  sectionTitle: string
  tenantSlug?: string
  children: React.ReactNode
}

export function RoleGuard({
  allowedRoles,
  tenantSlug,
  children,
}: RoleGuardProps) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)

  // Clave estable para evitar que re-renders de los formularios disparen re-verificación ni desmonten inputs
  const rolesKey = allowedRoles.join(',')
  const verifiedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const contextKey = `${rolesKey}::${tenantSlug || ''}`
    if (verifiedKeyRef.current === contextKey && authorized) {
      return
    }

    let active = true

    const verifyCurrentSession = async () => {
      if (verifiedKeyRef.current !== contextKey) {
        setChecking(true)
      }
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const data = await res.json()

        if (!active) return

        if (data.success && data.user) {
          const synced: CustomerProfile = {
            userId: data.user.id,
            fullName: data.user.fullName || 'Usuario',
            dni: data.user.dni || '',
            email: data.user.email || undefined,
            phone: data.user.phone || undefined,
            role: data.user.role,
            tenantSlug: data.user.tenantSlug || tenantSlug || undefined,
            authProvider: data.user.authProvider,
            hasPassword: data.user.hasPassword,
          }
          saveCustomerProfile(synced)

          const allowedList = rolesKey.split(',')
          const roleOk = Boolean(synced.role && allowedList.includes(synced.role))
          const tenantOk =
            synced.role === 'SUPER_ADMIN' || !tenantSlug || data.user.tenantSlug === tenantSlug

          if (roleOk && tenantOk) {
            verifiedKeyRef.current = contextKey
            setAuthorized(true)
            setChecking(false)
            return
          }

          router.replace(synced.tenantSlug ? `/${synced.tenantSlug}` : '/mi-cuenta')
          return
        }

        clearCustomerProfile()
        router.replace(tenantSlug ? `/${tenantSlug}` : '/mi-cuenta')
      } catch {
        if (active) {
          router.replace(tenantSlug ? `/${tenantSlug}` : '/mi-cuenta')
        }
      }
    }

    verifyCurrentSession()
    return () => {
      active = false
    }
  }, [rolesKey, router, tenantSlug, authorized])

  if (checking || !authorized) {
    return (
      <div className="min-h-screen bg-void-black text-white flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-4 border-t-purple-500 border-purple-950 animate-spin mb-3" />
        <p className="text-xs font-mono uppercase tracking-widest text-gray-400">
          Verificando permisos...
        </p>
      </div>
    )
  }

  return <>{children}</>
}
