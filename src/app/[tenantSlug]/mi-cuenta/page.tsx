'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CustomerProfile,
  getSavedCustomerProfile,
  saveCustomerProfile,
  clearCustomerProfile,
} from '@/lib/customer-session'
import { CustomerAuthModal } from '@/components/store/CustomerAuthModal'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  IdCard,
  KeyRound,
  ShieldCheck,
  Wine,
  Settings,
  QrCode,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
} from 'lucide-react'

export default function MiCuentaPage() {
  const params = useParams()
  const tenantSlug = typeof params?.tenantSlug === 'string' ? params.tenantSlug : 'demo-club'

  const [user, setUser] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  // Campos de edición
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    const saved = getSavedCustomerProfile()
    if (saved) {
      setUser(saved)
      setFullName(saved.fullName || '')
      setDni(saved.dni || '')
      setEmail(saved.email || '')
      setPhone(saved.phone || '')
    }

    fetch(`/api/auth/me?userId=${saved?.userId || ''}&dni=${saved?.dni || ''}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          const synced: CustomerProfile = {
            userId: data.user.id,
            fullName: data.user.fullName || saved?.fullName || '',
            dni: data.user.dni || saved?.dni || '',
            email: data.user.email || saved?.email || '',
            phone: data.user.phone || saved?.phone || '',
            role: data.user.role,
            tenantSlug: data.user.tenantSlug || tenantSlug,
            authProvider: data.user.authProvider,
            hasPassword: data.user.hasPassword,
          }
          saveCustomerProfile(synced)
          setUser(synced)
          setFullName(synced.fullName)
          setDni(synced.dni)
          setEmail(synced.email || '')
          setPhone(synced.phone || '')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tenantSlug])

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (newPassword && newPassword !== confirmPassword) {
      showToast('Las contraseñas nuevas no coinciden.', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          fullName,
          dni,
          email,
          phone,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        showToast(data.error || 'Error al actualizar los datos', 'error')
      } else {
        const updated: CustomerProfile = {
          userId: data.user.id,
          fullName: data.user.fullName,
          dni: data.user.dni || '',
          email: data.user.email || undefined,
          phone: data.user.phone || undefined,
          role: data.user.role,
          tenantSlug: data.user.tenantSlug || tenantSlug,
          authProvider: data.user.authProvider,
          hasPassword: data.user.hasPassword,
        }
        saveCustomerProfile(updated)
        setUser(updated)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        showToast('¡Tus datos y contraseña se actualizaron con éxito!')
      }
    } catch {
      showToast('Error de conexión con el servidor', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/me', { method: 'DELETE' }).catch(() => {})
    clearCustomerProfile()
    setUser(null)
    showToast('Sesión cerrada correctamente')
  }

  return (
    <div className="min-h-screen bg-[#07070c] text-white flex flex-col">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border shadow-2xl flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          )}
          <span className="text-sm font-medium">{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a10]/90 backdrop-blur-md border-b border-white/10 px-4 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${tenantSlug}`}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-black text-base text-white">Panel Mi Cuenta</h1>
              <p className="text-xs text-white/50">Datos personales, clave de acceso y rol</p>
            </div>
          </div>

          {user && (
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-white/50 text-sm">Cargando tu cuenta...</div>
        ) : !user ? (
          <div className="bg-[#12121a] border border-white/10 rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
              <UserPlus className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black">Iniciá Sesión o Creá tu Cuenta</h2>
            <p className="text-sm text-white/60 max-w-md mx-auto">
              Ingresá gratis con Google, Apple, tu correo electrónico o tu teléfono celular para gestionar tus compras, tu clave y tus permisos.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-purple-900/40"
            >
              Iniciar Sesión / Crear Cuenta
            </button>
          </div>
        ) : (
          <>
            {/* Tarjeta de Rol y Accesos */}
            <div className="bg-gradient-to-br from-purple-950/40 via-[#12121a] to-pink-950/20 border border-purple-500/30 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-2xl font-black shadow-lg shadow-purple-600/30">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-black">{user.fullName}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-wider">
                      Rol: {user.role || 'CUSTOMER'}
                    </span>
                    <span className="text-xs text-white/50">
                      Acceso vía {user.authProvider || 'credenciales'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Link
                  href={`/${tenantSlug}/mis-tragos`}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <QrCode className="w-4 h-4 text-purple-400" />
                  <span>Mis Tragos</span>
                </Link>

                {(user.role === 'BARTENDER' ||
                  user.role === 'CLUB_ADMIN' ||
                  user.role === 'SUPER_ADMIN') && (
                  <Link
                    href={`/${tenantSlug}/barra`}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Wine className="w-4 h-4" />
                    <span>Barra</span>
                  </Link>
                )}

                {(user.role === 'CLUB_ADMIN' || user.role === 'SUPER_ADMIN') && (
                  <Link
                    href={`/${tenantSlug}/admin`}
                    className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Club Admin</span>
                  </Link>
                )}

                {user.role === 'SUPER_ADMIN' && (
                  <Link
                    href="/superadmin"
                    className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>SuperAdmin</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Formulario de Edición de Datos y Contraseña */}
            <form
              onSubmit={handleSaveChanges}
              className="bg-[#12121a] border border-white/10 rounded-3xl p-6 space-y-6"
            >
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-purple-400" />
                  Datos Personales
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Nombre y Apellido
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      DNI (Documento)
                    </label>
                    <div className="relative">
                      <IdCard className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={dni}
                        onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Teléfono / Celular
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ej: 2236237874"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu.correo@ejemplo.com"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                  <KeyRound className="w-4 h-4 text-pink-400" />
                  Seguridad y Contraseña
                </h3>
                <p className="text-xs text-white/50 mb-4">
                  Dejá estos campos vacíos si solo querés actualizar tus datos personales.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Clave Actual
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Nueva Clave
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Repetir Nueva Clave
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirmar clave"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-purple-900/40 disabled:opacity-50"
                >
                  {saving ? 'Guardando cambios...' : 'Guardar Datos y Clave'}
                </button>
              </div>
            </form>
          </>
        )}
      </main>

      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(profile) => {
          setUser(profile)
          setFullName(profile.fullName)
          setDni(profile.dni)
          setEmail(profile.email || '')
          setPhone(profile.phone || '')
        }}
        tenantSlug={tenantSlug}
      />
    </div>
  )
}
