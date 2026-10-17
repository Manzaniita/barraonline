'use client'

import React, { useState, useEffect } from 'react'
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
  UserPlus,
  ChevronRight,
} from 'lucide-react'

interface DeviceSocialAccount {
  email: string
  fullName: string
  avatarUrl?: string | null
  provider?: 'google' | 'apple'
  role?: string
}

const DEVICE_ACCOUNTS_KEY = 'bo_device_social_accounts_v1'

function getSavedDeviceAccounts(): DeviceSocialAccount[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DEVICE_ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function addDeviceAccount(acc: DeviceSocialAccount) {
  if (typeof window === 'undefined') return
  try {
    const current = getSavedDeviceAccounts()
    const filtered = current.filter(
      (a) => a.email.toLowerCase() !== acc.email.toLowerCase()
    )
    const updated = [acc, ...filtered].slice(0, 6)
    localStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(updated))
  } catch {}
}

interface CustomerAuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (profile: CustomerProfile) => void
  requiredNotice?: string
  tenantSlug?: string
}

export function CustomerAuthModal({
  isOpen,
  onClose,
  onSuccess,
  requiredNotice,
  tenantSlug = 'demo-club',
}: CustomerAuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'social_picker' | 'account'>('login')
  const [socialProvider, setSocialProvider] = useState<'google' | 'apple'>('google')
  const [showOtherAccountInput, setShowOtherAccountInput] = useState(false)
  const [deviceAccounts, setDeviceAccounts] = useState<DeviceSocialAccount[]>([])

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
  const [selectingEmail, setSelectingEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setSuccessMsg(null)
      setShowOtherAccountInput(false)

      // Cargar cuentas recordadas en el teléfono + cuentas activas
      const localAccounts = getSavedDeviceAccounts()
      setDeviceAccounts(localAccounts)

      fetch('/api/auth/social')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.accounts)) {
            const mergedMap = new Map<string, DeviceSocialAccount>()
            for (const a of localAccounts) {
              mergedMap.set(a.email.toLowerCase(), a)
            }
            for (const s of data.accounts) {
              if (s.email && !mergedMap.has(s.email.toLowerCase())) {
                mergedMap.set(s.email.toLowerCase(), {
                  email: s.email,
                  fullName: s.fullName || s.email.split('@')[0],
                  avatarUrl: s.avatarUrl,
                  role: s.role,
                })
              }
            }
            setDeviceAccounts(Array.from(mergedMap.values()))
          }
        })
        .catch(() => {})

      const saved = getSavedCustomerProfile()
      if (saved) {
        setCurrentUser(saved)
        setFullName(saved.fullName || '')
        setDni(saved.dni || '')
        setEmail(saved.email || '')
        setPhone(saved.phone || '')
        setMode('account')

        fetch(`/api/auth/me?userId=${saved.userId || ''}&dni=${saved.dni || ''}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.user) {
              const updatedProfile: CustomerProfile = {
                userId: data.user.id,
                fullName: data.user.fullName || saved.fullName,
                dni: data.user.dni || saved.dni || '',
                email: data.user.email || saved.email,
                phone: data.user.phone || saved.phone,
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
            }
          })
          .catch(() => {})
      } else {
        setCurrentUser(null)
        setMode('login')
      }
    }
  }, [isOpen, tenantSlug])

  if (!isOpen) return null

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
    if (profile.email) {
      addDeviceAccount({
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
      })
    }
    saveCustomerProfile(profile)
    setCurrentUser(profile)
    onSuccess(profile)
  }

  /**
   * 1-Tap Login / Registro automático al elegir una cuenta del selector de Google o Apple.
   * Si la cuenta no existe la crea sola; si ya existe inicia sesión directo.
   */
  const handleSelectSocialAccount = async (
    selectedEmail: string,
    selectedName?: string,
    providerOverride?: 'google' | 'apple'
  ) => {
    const targetProvider = providerOverride || socialProvider
    setError(null)
    setSelectingEmail(selectedEmail)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: targetProvider,
          email: selectedEmail.trim(),
          fullName: selectedName?.trim() || undefined,
          tenantSlug,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'No se pudo ingresar con la cuenta seleccionada.')
      } else {
        syncAndFinish(data.user)
        onClose()
      }
    } catch {
      setError('Error de conexión al iniciar sesión.')
    } finally {
      setSelectingEmail(null)
      setLoading(false)
    }
  }

  /**
   * Dispara el selector nativo de Google Identity Services si hay GOOGLE_CLIENT_ID,
   * o abre la hoja nativa de selección de cuentas del celular en 1 toque.
   */
  const handleOpenSocialPicker = (provider: 'google' | 'apple') => {
    setSocialProvider(provider)
    setError(null)
    setShowOtherAccountInput(false)

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (
      provider === 'google' &&
      googleClientId &&
      typeof window !== 'undefined' &&
      (window as any).google?.accounts?.oauth2
    ) {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: async (resp: any) => {
          if (resp?.access_token) {
            const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${resp.access_token}` },
            })
            const info = await infoRes.json()
            if (info?.email) {
              await handleSelectSocialAccount(info.email, info.name, 'google')
            }
          }
        },
      })
      tokenClient.requestAccessToken()
      return
    }

    setMode('social_picker')
  }

  // Iniciar Sesión con Correo / Teléfono / DNI + Clave
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
        setError(data.error || 'No se pudo iniciar sesión.')
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

  // Crear Cuenta Nueva con Correo/Teléfono y Clave
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

  // Actualizar datos y/o clave en Mi Cuenta
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
          userId: currentUser?.userId,
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#121218] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-white my-auto max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* MODO 1: SELECTOR RÁPIDO DE CUENTAS DEL CELULAR (GOOGLE / APPLE 1-TAP) */}
        {mode === 'social_picker' ? (
          <div className="space-y-4">
            <div className="text-center pt-1 pb-2 border-b border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-3 shadow-inner">
                {socialProvider === 'google' ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
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
                ) : (
                  <svg className="w-6 h-6 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                )}
              </div>
              <h3 className="font-bold text-lg text-white">
                Elegí una cuenta
              </h3>
              <p className="text-xs text-white/60 mt-0.5">
                para continuar a <span className="text-purple-400 font-semibold">BarraOnline</span> con{' '}
                {socialProvider === 'google' ? 'Google' : 'Apple'}
              </p>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                {error}
              </div>
            )}

            {/* Lista de Cuentas para tocar y entrar en 1 clic */}
            <div className="divide-y divide-white/10 border border-white/10 rounded-2xl overflow-hidden bg-white/[0.03]">
              {deviceAccounts.map((acc) => {
                const isSelecting = selectingEmail === acc.email
                return (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={loading}
                    onClick={() => handleSelectSocialAccount(acc.email, acc.fullName)}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/10 active:bg-white/15 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {acc.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {acc.fullName}
                        </div>
                        <div className="text-xs text-white/60 truncate">
                          {acc.email}
                        </div>
                      </div>
                    </div>

                    {isSelecting ? (
                      <div className="w-4 h-4 rounded-full border-2 border-t-purple-400 border-white/20 animate-spin shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                    )}
                  </button>
                )
              })}

              {/* Opción Usar otra cuenta */}
              {!showOtherAccountInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherAccountInput(true)
                    setEmail('')
                  }}
                  className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/80 shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-white/90">
                    Usar otra cuenta de {socialProvider === 'google' ? 'Google' : 'Apple'}
                  </span>
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (email.trim()) {
                      handleSelectSocialAccount(email.trim())
                    }
                  }}
                  className="p-4 space-y-3 bg-black/30"
                >
                  <input
                    type="email"
                    required
                    autoFocus
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      socialProvider === 'google'
                        ? 'tu.correo@gmail.com'
                        : 'tu.correo@icloud.com'
                    }
                    className="w-full bg-white/5 border border-white/15 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs shadow-lg"
                  >
                    {loading ? 'Ingresando...' : 'Continuar con esta cuenta'}
                  </button>
                </form>
              )}
            </div>

            <p className="text-[11px] text-white/40 text-center leading-relaxed px-2">
              Si no tenés cuenta en BarraOnline se creará automáticamente, y si ya tenés se iniciará tu sesión al instante.
            </p>

            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full py-2 text-xs font-semibold text-white/50 hover:text-white transition-colors"
            >
              Volver a opciones de ingreso
            </button>
          </div>
        ) : mode === 'account' && currentUser ? (
          /* MODO 2: MI CUENTA (USUARIO LOGUEADO) */
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-purple-600/30">
                {currentUser.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{currentUser.fullName}</h3>
                <span
                  className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    getRoleLabel(currentUser.role).color
                  }`}
                >
                  {getRoleLabel(currentUser.role).text}
                </span>
              </div>
            </div>

            {/* Accesos Rápidos según el Rol asignado */}
            {(currentUser.role === 'BARTENDER' ||
              currentUser.role === 'CLUB_ADMIN' ||
              currentUser.role === 'SUPER_ADMIN') && (
              <div className="mb-4 p-3 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                  Accesos de Personal Autorizado
                </span>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/${tenantSlug}/barra`}
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Wine className="w-3.5 h-3.5" />
                    <span>Ir a Barra (Escáner)</span>
                  </Link>
                  {(currentUser.role === 'CLUB_ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                    <Link
                      href={`/${tenantSlug}/admin`}
                      onClick={onClose}
                      className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Panel Club Admin</span>
                    </Link>
                  )}
                  {currentUser.role === 'SUPER_ADMIN' && (
                    <Link
                      href="/superadmin"
                      onClick={onClose}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>SuperAdmin</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Nombre y Apellido
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">DNI</label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={dni}
                      onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Teléfono</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej: 1123456789"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5 mb-2">
                  <KeyRound className="w-3.5 h-3.5" />
                  Cambiar o Definir Contraseña
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentUser.hasPassword && (
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Clave actual (opcional)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-purple-500"
                    />
                  )}
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña (mín. 4)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-purple-500 sm:col-span-2"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-purple-900/30 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>

            <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="text-[11px] text-white/40">Sesión activa en este dispositivo</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        ) : (
          /* MODO 3: LOGIN / CREAR CUENTA */
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">
                  {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta Gratis'}
                </h3>
                <p className="text-xs text-white/60">
                  Elegí tu cuenta del celular o ingresá con clave
                </p>
              </div>
            </div>

            {requiredNotice && (
              <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
                {requiredNotice}
              </div>
            )}

            {/* Botones 1-Tap Google y Apple (arriba y prominentes) */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => handleOpenSocialPicker('google')}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white text-gray-900 hover:bg-gray-100 font-bold text-xs transition-all shadow-md active:scale-95"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenSocialPicker('apple')}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs transition-all active:scale-95"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <span>Apple</span>
              </button>
            </div>

            <div className="relative flex py-1.5 items-center mb-3">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-3 text-[11px] text-white/40 uppercase tracking-wider">
                o con correo / teléfono
              </span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* Selector de pestaña Iniciar Sesión / Crear Cuenta */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-xl mb-4 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === 'login'
                    ? 'bg-purple-600 text-white shadow'
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
                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Crear Cuenta
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                {error}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Correo, Teléfono o DNI *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Correo, celular o DNI"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Contraseña *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tu contraseña"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-9 text-sm focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-900/40 text-sm transition-all disabled:opacity-50"
                >
                  {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Nombre y Apellido *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej: Joaquín Vidal"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">
                      DNI *
                    </label>
                    <div className="relative">
                      <IdCard className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        required
                        value={dni}
                        onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                        placeholder="Ej: 46951684"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">
                      Teléfono / Celular
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="2236237874"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tucorreo@ejemplo.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Crear Contraseña *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 4 caracteres"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-9 text-sm focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-900/40 text-sm transition-all disabled:opacity-50"
                >
                  {loading ? 'Creando Cuenta...' : 'Crear Cuenta y Continuar'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
