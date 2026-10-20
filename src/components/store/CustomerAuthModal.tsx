'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  CustomerProfile,
  getSavedCustomerProfile,
  saveCustomerProfile,
  clearCustomerProfile,
  isValidDni,
  isValidFullName,
} from '@/lib/customer-session'
import {
  ShieldCheck,
  User,
  Phone,
  IdCard,
  Mail,
  Lock,
  X,
  LogOut,
  KeyRound,
  CheckCircle2,
  Wine,
  Settings,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface CustomerAuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (profile: CustomerProfile) => void
  requiredNotice?: string
  initialError?: string | null
  tenantSlug?: string
}

export function CustomerAuthModal({
  isOpen,
  onClose,
  onSuccess,
  requiredNotice,
  initialError,
  tenantSlug = 'demo-club',
}: CustomerAuthModalProps) {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<'login' | 'register' | 'account'>('login')

  // Campos de formulario
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Cambio de clave en Mi Cuenta
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [currentUser, setCurrentUser] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthRedirecting, setOauthRedirecting] = useState<'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Bloquear scroll de la página y cerrar con la tecla Escape
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      setError(initialError || null)
      setSuccessMsg(null)
      setOauthRedirecting(null)

      try {
        localStorage.removeItem('bo_device_social_accounts_v1')
      } catch {}

      fetch('/api/auth/me', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.user) {
            const updatedProfile: CustomerProfile = {
              userId: data.user.id,
              fullName: data.user.fullName || 'Usuario',
              dni: data.user.dni || '',
              email: data.user.email || undefined,
              phone: data.user.phone || undefined,
              role: data.user.role,
              tenantSlug: data.user.tenantSlug || tenantSlug,
              authProvider: data.user.authProvider,
              hasPassword: data.user.hasPassword,
            }
            saveCustomerProfile(updatedProfile)
            setCurrentUser(updatedProfile)
            setFullName(updatedProfile.fullName)
            setDni(updatedProfile.dni)
            setEmail(updatedProfile.email || '')
            setPhone(updatedProfile.phone || '')
            setMode('account')
          } else {
            clearCustomerProfile()
            setCurrentUser(null)
            setMode('login')
          }
        })
        .catch(() => {
          const saved = getSavedCustomerProfile()
          if (saved) {
            setCurrentUser(saved)
            setFullName(saved.fullName || '')
            setDni(saved.dni || '')
            setEmail(saved.email || '')
            setPhone(saved.phone || '')
            setMode('account')
          } else {
            setCurrentUser(null)
            setMode('login')
          }
        })
    }
  }, [isOpen, tenantSlug, initialError])

  if (!mounted || !isOpen) return null

  const syncAndFinish = (apiUser: any) => {
    const profile: CustomerProfile = {
      userId: apiUser.id,
      dni: apiUser.dni || '',
      fullName: apiUser.fullName || 'Usuario',
      email: apiUser.email || undefined,
      phone: apiUser.phone || undefined,
      role: apiUser.role || 'CUSTOMER',
      tenantSlug: apiUser.tenantSlug || tenantSlug,
      authProvider: apiUser.authProvider || 'credentials',
      hasPassword: apiUser.hasPassword,
    }
    saveCustomerProfile(profile)
    setCurrentUser(profile)
    onSuccess(profile)
  }

  const handleNativeOAuth = async () => {
    setError(null)
    setOauthRedirecting('google')
    const returnTo =
      typeof window !== 'undefined' ? window.location.pathname : `/${tenantSlug}`

    try {
      // 1. Consultar si tiene credenciales oficiales configuradas en el servidor
      const checkRes = await fetch('/api/auth/oauth/google?check=true')
      const checkData = await checkRes.json()

      if (checkData?.configured) {
        // Redirigir directamente al flujo oficial OAuth 2.0 / OpenID Connect de Google
        const url = `/api/auth/oauth/google?returnTo=${encodeURIComponent(
          returnTo
        )}&tenant=${encodeURIComponent(tenantSlug)}`
        window.location.assign(url)
        return
      }

      // 2. Si las credenciales aún no se configuraron en las variables de entorno
      setOauthRedirecting(null)
      setError(
        'El inicio de sesión con Google requiere configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en las variables de entorno de Vercel.'
      )
    } catch (err) {
      console.error('Error al conectar con el servidor:', err)
      setOauthRedirecting(null)
      setError('Error de conexión al iniciar autenticación con Google.')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Datos de acceso incorrectos.')
      } else {
        syncAndFinish(data.user)
        onClose()
      }
    } catch {
      setError('Error de conexión con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanDni = dni.replace(/\D/g, '')
    if (!isValidDni(cleanDni)) {
      setError('Ingresá un DNI válido (7 a 9 dígitos) para asociar tus tragos.')
      return
    }
    if (!isValidFullName(fullName)) {
      setError('Ingresá tu nombre y apellido.')
      return
    }
    if (!email.trim() && !phone.trim()) {
      setError('Ingresá al menos tu correo electrónico o tu teléfono.')
      return
    }
    if (password.length < 4) {
      setError('La clave debe tener al menos 4 caracteres.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          dni: cleanDni,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password,
          tenantSlug,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Error al crear la cuenta.')
      } else {
        syncAndFinish(data.user)
        onClose()
      }
    } catch {
      setError('Error de conexión al registrar.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        setError(data.error || 'No se pudieron actualizar los datos.')
      } else {
        syncAndFinish(data.user)
        setCurrentPassword('')
        setNewPassword('')
        setSuccessMsg('¡Datos y seguridad actualizados correctamente!')
      }
    } catch {
      setError('Error de conexión al guardar cambios.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/me', { method: 'DELETE' }).catch(() => {})
    clearCustomerProfile()
    setCurrentUser(null)
    setIdentifier('')
    setPassword('')
    setMode('login')
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { text: 'SuperAdmin Plataforma', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' }
      case 'CLUB_ADMIN':
        return { text: 'Admin del Boliche', color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' }
      case 'BARTENDER':
        return { text: 'Bartender Autorizado', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
      default:
        return { text: 'Cliente', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md transition-all animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-md bg-obsidian-surface border border-obsidian-border rounded-3xl shadow-[0_0_60px_rgba(168,85,247,0.22)] overflow-hidden text-white my-auto max-h-[90vh] flex flex-col">
        {/* Resplandor decorativo neon nocturno superior */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-gradient-to-b from-purple-500/30 via-pink-500/15 to-transparent blur-3xl pointer-events-none rounded-full" />

        {/* Botón de cierre circular estilizado */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-white/50 hover:text-white rounded-full bg-white/5 hover:bg-white/15 border border-white/10 transition-all active:scale-95"
          aria-label="Cerrar modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Cabecera del modal */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
          {mode === 'account' && currentUser ? (
            <div className="flex items-center gap-3.5 pr-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/30 shrink-0">
                {currentUser.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-lg text-white leading-tight truncate">
                  {currentUser.fullName}
                </h3>
                <span
                  className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    getRoleLabel(currentUser.role).color
                  }`}
                >
                  {getRoleLabel(currentUser.role).text}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3.5 pr-8">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-pink-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner shrink-0">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-black text-lg text-white leading-tight">
                  {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Ingresá con tu cuenta para acceder a tus tragos
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Cuerpo del modal con scroll interno suave */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {mode === 'account' && currentUser ? (
            /* MODO MI CUENTA (USUARIO LOGUEADO) */
            <div className="space-y-4">
              {/* Accesos Rápidos según el Rol autorizado */}
              {(currentUser.role === 'BARTENDER' ||
                currentUser.role === 'CLUB_ADMIN' ||
                currentUser.role === 'SUPER_ADMIN') && (
                <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                    Accesos de Personal Autorizado
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/${currentUser.tenantSlug || tenantSlug}/barra`}
                      onClick={onClose}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-purple-900/30"
                    >
                      <Wine className="w-3.5 h-3.5" />
                      <span>Ir a Barra (Escáner)</span>
                    </Link>
                    {(currentUser.role === 'CLUB_ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                      <Link
                        href={`/${currentUser.tenantSlug || tenantSlug}/admin`}
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-pink-900/30"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Panel Club Admin</span>
                      </Link>
                    )}
                    {currentUser.role === 'SUPER_ADMIN' && (
                      <Link
                        href="/superadmin"
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-900/30"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>SuperAdmin</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleUpdateAccount} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Nombre y Apellido
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">DNI</label>
                    <div className="relative">
                      <IdCard className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={dni}
                        onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">Teléfono</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ej: 1123456789"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tucorreo@ejemplo.com"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5 mb-2.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Cambiar o Definir Contraseña
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentUser.hasPassword && (
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Clave actual"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500 focus:bg-white/[0.08]"
                      />
                    )}
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nueva contraseña (mín. 4)"
                      className={`w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] ${
                        currentUser.hasPassword ? '' : 'sm:col-span-2'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3">
                  <Link
                    href={`/${tenantSlug}/mi-cuenta`}
                    onClick={onClose}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                  >
                    <span>Abrir Panel Mi Cuenta</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-purple-900/30 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </button>
                </div>
              </form>

              <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                <span className="text-[11px] text-white/40">Sesión activa en este dispositivo</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          ) : (
            /* MODO LOGIN / CREAR CUENTA */
            <div className="space-y-4">
              {requiredNotice && (
                <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{requiredNotice}</span>
                </div>
              )}

              {/* Botón Nativo Oficial de Google OAuth */}
              <button
                type="button"
                disabled={Boolean(oauthRedirecting)}
                onClick={handleNativeOAuth}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white text-gray-900 hover:bg-gray-100 font-bold text-sm transition-all shadow-md active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {oauthRedirecting === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                )}
                <span>{oauthRedirecting === 'google' ? 'Abriendo Google...' : 'Continuar con Google'}</span>
              </button>

              {/* Separador elegante */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-white/10" />
                <span className="flex-shrink mx-3 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  o con tus datos
                </span>
                <div className="flex-grow border-t border-white/10" />
              </div>

              {/* Selector de pestaña Iniciar Sesión / Crear Cuenta con pill segmentado */}
              <div className="grid grid-cols-2 p-1 bg-white/[0.05] rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-900/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError(null)
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-900/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Crear Cuenta
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Correo, Celular o DNI
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="tu.correo@ejemplo.com o DNI"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Tu contraseña de acceso"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-95 text-white font-bold py-3.5 px-4 rounded-2xl shadow-xl shadow-purple-900/40 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{loading ? 'Ingresando...' : 'Iniciar Sesión'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Nombre y Apellido *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ej: Joaquín Vidal"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        DNI *
                      </label>
                      <div className="relative">
                        <IdCard className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          inputMode="numeric"
                          required
                          value={dni}
                          onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                          placeholder="46951684"
                          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-1.5">
                        Celular
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="2236237874"
                          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tucorreo@ejemplo.com"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Crear Contraseña *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-purple-500/30 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-95 text-white font-bold py-3.5 px-4 rounded-2xl shadow-xl shadow-purple-900/40 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{loading ? 'Creando Cuenta...' : 'Crear Cuenta y Continuar'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
