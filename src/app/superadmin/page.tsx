'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  Building2,
  DollarSign,
  TrendingUp,
  Percent,
  PlusCircle,
  ExternalLink,
  RefreshCw,
  Wine,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Sliders,
  Settings,
  UserCheck,
  Edit2,
  Trash2,
  X,
  CreditCard,
  Clock,
  Globe,
  Palette,
  Loader2,
} from 'lucide-react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { UsersRoleManager } from '@/components/admin/UsersRoleManager'

interface TenantSummary {
  id: string
  name: string
  slug: string
  domain: string
  status: string
  subscriptionStatus: string
  isActive: boolean
  plan: string
  brandColor: string
  accentColor: string
  nightclubName: string
  tagline: string
  defaultExpirationHour: string
  mpSellerId: string
  mpPublicKey: string
  mpAccessTokenEnc: string
  feePercentage: number
  totalOrders: number
  totalProducts: number
  totalStaff: number
  totalAdmins: number
  admins: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
    dni: string | null
    role: string
    hasPassword: boolean
    createdAt: string
  }[]
  totalRevenue: number
  totalFees: number
  createdAt: string
}

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState<'tenants' | 'users'>('tenants')

  // Modal para gestionar Administradores del Boliche
  const [managingAdminsTenant, setManagingAdminsTenant] = useState<TenantSummary | null>(null)
  const [adminModalTab, setAdminModalTab] = useState<'list' | 'create' | 'link'>('list')
  const [adminFullName, setAdminFullName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [adminDni, setAdminDni] = useState('')
  const [creatingAdmin, setCreatingAdmin] = useState(false)

  // Editar admin dentro del modal
  const [editingAdminUser, setEditingAdminUser] = useState<any | null>(null)
  const [editAdminName, setEditAdminName] = useState('')
  const [editAdminEmail, setEditAdminEmail] = useState('')
  const [editAdminPhone, setEditAdminPhone] = useState('')
  const [editAdminDni, setEditAdminDni] = useState('')
  const [editAdminPassword, setEditAdminPassword] = useState('')
  const [savingAdminEdit, setSavingAdminEdit] = useState(false)

  // Búsqueda para vincular usuario existente
  const [linkSearchQuery, setLinkSearchQuery] = useState('')
  const [linkSearchResults, setLinkSearchResults] = useState<any[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [linkingUser, setLinkingUser] = useState(false)

  // Modal para crear boliche
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [newFee, setNewFee] = useState(5.0)
  const [newPlan, setNewPlan] = useState('PRO')
  const [newBrandColor, setNewBrandColor] = useState('#8B5CF6')
  const [newAccentColor, setNewAccentColor] = useState('#EC4899')
  const [newNightclubName, setNewNightclubName] = useState('')
  const [newTagline, setNewTagline] = useState('Barra Rápida QR • Cero Colas')
  const [newExpirationHour, setNewExpirationHour] = useState('07:00')
  const [newMpSellerId, setNewMpSellerId] = useState('')
  const [newMpPublicKey, setNewMpPublicKey] = useState('')
  const [newMpAccessToken, setNewMpAccessToken] = useState('')
  const [creating, setCreating] = useState(false)

  // Modal para editar boliche
  const [editingTenant, setEditingTenant] = useState<TenantSummary | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editDomain, setEditDomain] = useState('')
  const [editFee, setEditFee] = useState(5.0)
  const [editPlan, setEditPlan] = useState('PRO')
  const [editBrandColor, setEditBrandColor] = useState('#8B5CF6')
  const [editAccentColor, setEditAccentColor] = useState('#EC4899')
  const [editNightclubName, setEditNightclubName] = useState('')
  const [editTagline, setEditTagline] = useState('')
  const [editExpirationHour, setEditExpirationHour] = useState('07:00')
  const [editSubscriptionStatus, setEditSubscriptionStatus] = useState('ACTIVE')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editMpSellerId, setEditMpSellerId] = useState('')
  const [editMpPublicKey, setEditMpPublicKey] = useState('')
  const [editMpAccessToken, setEditMpAccessToken] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Modal para borrar boliche
  const [deletingTenant, setDeletingTenant] = useState<TenantSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Notificación rápida
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchTenants = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/superadmin/tenants', { cache: 'no-store' })
      const data = await res.json()
      if (data.success && data.tenants) {
        setTenants(data.tenants)
      } else {
        showToast(data.error || 'Error cargando boliches', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Error de conexión con el servidor', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  // Auto-slug a partir del nombre en creación
  const handleNameChange = (val: string) => {
    setNewName(val)
    if (!newNightclubName) setNewNightclubName(val)
    const slugified = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setNewSlug(slugified)
  }

  // Abrir modal de edición con datos pre-cargados
  const openEditTenant = (t: TenantSummary) => {
    setEditingTenant(t)
    setEditName(t.name)
    setEditSlug(t.slug)
    setEditDomain(t.domain || '')
    setEditFee(t.feePercentage)
    setEditPlan(t.plan || 'PRO')
    setEditBrandColor(t.brandColor || '#8B5CF6')
    setEditAccentColor(t.accentColor || '#EC4899')
    setEditNightclubName(t.nightclubName || t.name)
    setEditTagline(t.tagline || 'Barra Rápida QR')
    setEditExpirationHour(t.defaultExpirationHour || '07:00')
    setEditSubscriptionStatus(t.subscriptionStatus || 'ACTIVE')
    setEditIsActive(t.isActive)
    setEditMpSellerId(t.mpSellerId || '')
    setEditMpPublicKey(t.mpPublicKey || '')
    setEditMpAccessToken(t.mpAccessTokenEnc || '')
  }

  // Crear nuevo boliche
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newSlug) return

    setCreating(true)
    try {
      const res = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          slug: newSlug,
          domain: newDomain || undefined,
          feePercentage: newFee,
          plan: newPlan,
          brandColor: newBrandColor,
          accentColor: newAccentColor,
          nightclubName: newNightclubName || newName,
          tagline: newTagline,
          defaultExpirationHour: newExpirationHour,
          mpSellerId: newMpSellerId || undefined,
          mpPublicKey: newMpPublicKey || undefined,
          mpAccessTokenEnc: newMpAccessToken || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Boliche "${newName}" provisionado con éxito`)
        setShowCreateModal(false)
        setNewName('')
        setNewSlug('')
        setNewDomain('')
        setNewNightclubName('')
        setNewMpSellerId('')
        setNewMpPublicKey('')
        setNewMpAccessToken('')
        fetchTenants()
      } else {
        showToast(data.error || 'Error al crear boliche', 'error')
      }
    } catch (err) {
      showToast('Error de conexión', 'error')
    } finally {
      setCreating(false)
    }
  }

  // Guardar edición de boliche (PUT)
  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTenant || !editName || !editSlug) return

    setSavingEdit(true)
    try {
      const res = await fetch('/api/superadmin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTenant.id,
          name: editName,
          slug: editSlug,
          domain: editDomain || null,
          feePercentage: editFee,
          plan: editPlan,
          brandColor: editBrandColor,
          accentColor: editAccentColor,
          nightclubName: editNightclubName || editName,
          tagline: editTagline,
          defaultExpirationHour: editExpirationHour,
          subscriptionStatus: editSubscriptionStatus,
          isActive: editIsActive,
          mpSellerId: editMpSellerId || null,
          mpPublicKey: editMpPublicKey || null,
          mpAccessTokenEnc: editMpAccessToken || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Boliche "${editName}" actualizado con éxito`)
        setEditingTenant(null)
        fetchTenants()
      } else {
        showToast(data.error || 'Error al actualizar boliche', 'error')
      }
    } catch {
      showToast('Error de conexión con el servidor', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  // Eliminar boliche definitivamente (DELETE)
  const handleDeleteTenant = async () => {
    if (!deletingTenant) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/superadmin/tenants?id=${deletingTenant.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || `Boliche ${deletingTenant.name} eliminado`)
        setDeletingTenant(null)
        setTenants((prev) => prev.filter((t) => t.id !== deletingTenant.id))
      } else {
        showToast(data.error || 'Error al eliminar boliche', 'error')
      }
    } catch {
      showToast('Error de conexión con el servidor', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Cambiar estado activo/suspendido rápido
  const handleToggleStatus = async (tenant: TenantSummary) => {
    const nextStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    try {
      const res = await fetch('/api/superadmin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tenant.id,
          status: nextStatus,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Boliche ${tenant.name} ahora está ${nextStatus === 'ACTIVE' ? 'Activo' : 'Suspendido'}`)
        fetchTenants()
      } else {
        showToast(data.error || 'Error actualizando estado', 'error')
      }
    } catch (err) {
      showToast('Error de conexión', 'error')
    }
  }

  // Crear Administrador para un boliche
  const handleCreateTenantAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!managingAdminsTenant || !adminFullName || !adminPassword) return

    setCreatingAdmin(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: adminFullName,
          email: adminEmail || undefined,
          phone: adminPhone || undefined,
          dni: adminDni || undefined,
          password: adminPassword,
          role: 'CLUB_ADMIN',
          tenantId: managingAdminsTenant.id,
          tenantSlug: managingAdminsTenant.slug,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Administrador "${adminFullName}" creado y asignado con éxito`)
        setAdminFullName('')
        setAdminEmail('')
        setAdminPassword('')
        setAdminPhone('')
        setAdminDni('')
        setAdminModalTab('list')
        const updatedTenantsRes = await fetch('/api/superadmin/tenants', { cache: 'no-store' })
        const updatedData = await updatedTenantsRes.json()
        if (updatedData.success && updatedData.tenants) {
          setTenants(updatedData.tenants)
          const curr = updatedData.tenants.find((t: any) => t.id === managingAdminsTenant.id)
          if (curr) setManagingAdminsTenant(curr)
        }
      } else {
        showToast(data.error || 'Error al crear administrador', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setCreatingAdmin(false)
    }
  }

  // Revocar Administrador
  const handleRevokeAdmin = async (adminId: string, adminName: string) => {
    if (!managingAdminsTenant) return
    if (!confirm(`¿Estás seguro de revocar el rol de Administrador a "${adminName}" para este boliche? Pasará a rol Cliente.`)) {
      return
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: adminId,
          role: 'CUSTOMER',
          tenantId: null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Permiso de Administrador revocado a ${adminName}`)
        const updatedTenantsRes = await fetch('/api/superadmin/tenants', { cache: 'no-store' })
        const updatedData = await updatedTenantsRes.json()
        if (updatedData.success && updatedData.tenants) {
          setTenants(updatedData.tenants)
          const curr = updatedData.tenants.find((t: any) => t.id === managingAdminsTenant.id)
          if (curr) setManagingAdminsTenant(curr)
        }
      } else {
        showToast(data.error || 'Error al revocar administrador', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    }
  }

  // Guardar edición de datos / clave de admin
  const handleSaveAdminEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAdminUser || !managingAdminsTenant) return

    setSavingAdminEdit(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingAdminUser.id,
          fullName: editAdminName,
          email: editAdminEmail || null,
          phone: editAdminPhone || null,
          dni: editAdminDni || null,
          newPassword: editAdminPassword.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Datos del Administrador "${editAdminName}" actualizados`)
        setEditingAdminUser(null)
        const updatedTenantsRes = await fetch('/api/superadmin/tenants', { cache: 'no-store' })
        const updatedData = await updatedTenantsRes.json()
        if (updatedData.success && updatedData.tenants) {
          setTenants(updatedData.tenants)
          const curr = updatedData.tenants.find((t: any) => t.id === managingAdminsTenant.id)
          if (curr) setManagingAdminsTenant(curr)
        }
      } else {
        showToast(data.error || 'Error actualizando administrador', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSavingAdminEdit(false)
    }
  }

  // Buscar usuarios para vincular
  const searchUsersToLink = async (term: string) => {
    setLinkSearchQuery(term)
    if (!term.trim() || term.trim().length < 2) {
      setLinkSearchResults([])
      return
    }
    setSearchingUsers(true)
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(term.trim())}`)
      const data = await res.json()
      if (data.success && data.users) {
        setLinkSearchResults(data.users.filter((u: any) => u.role !== 'SUPER_ADMIN'))
      }
    } catch {
      console.error('Error buscando usuarios')
    } finally {
      setSearchingUsers(false)
    }
  }

  // Vincular usuario existente como admin
  const handleLinkExistingUser = async (userId: string, userName: string) => {
    if (!managingAdminsTenant) return
    setLinkingUser(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          role: 'CLUB_ADMIN',
          tenantSlug: managingAdminsTenant.slug,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`"${userName}" ahora es Administrador de ${managingAdminsTenant.name}`)
        setLinkSearchQuery('')
        setLinkSearchResults([])
        setAdminModalTab('list')
        const updatedTenantsRes = await fetch('/api/superadmin/tenants', { cache: 'no-store' })
        const updatedData = await updatedTenantsRes.json()
        if (updatedData.success && updatedData.tenants) {
          setTenants(updatedData.tenants)
          const curr = updatedData.tenants.find((t: any) => t.id === managingAdminsTenant.id)
          if (curr) setManagingAdminsTenant(curr)
        }
      } else {
        showToast(data.error || 'Error al asignar administrador', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setLinkingUser(false)
    }
  }

  // Métricas globales acumuladas
  const globalRevenue = tenants.reduce((acc, t) => acc + t.totalRevenue, 0)
  const globalFees = tenants.reduce((acc, t) => acc + t.totalFees, 0)
  const globalOrders = tenants.reduce((acc, t) => acc + t.totalOrders, 0)
  const activeTenantsCount = tenants.filter((t) => t.status === 'ACTIVE').length

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070b] text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full border-4 border-t-purple-500 border-purple-950 animate-spin mb-4" />
        <p className="text-gray-400 font-mono text-sm uppercase tracking-widest">
          Cargando Panel SuperAdmin BarraOnline...
        </p>
      </div>
    )
  }

  return (
    <RoleGuard
      allowedRoles={['SUPER_ADMIN']}
      sectionTitle="Panel SuperAdmin Plataforma"
    >
      <div className="min-h-screen bg-[#07070a] text-gray-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.text}</span>
          </div>
        )}

        {/* HEADER SUPERADMIN */}
        <header className="sticky top-0 z-40 bg-[#0a0a10]/90 backdrop-blur-md border-b border-purple-900/30 px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  BarraOnline Platform
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold uppercase tracking-wider">
                  SuperAdmin
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Control centralizado multi-tenant, usuarios y liquidación de comisiones SaaS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/demo-club/mi-cuenta"
              className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-purple-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Mi Cuenta</span>
            </Link>

            <button
              onClick={() => fetchTenants(true)}
              disabled={refreshing}
              className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-xs font-medium flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
              <span>Refrescar</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Alta Nuevo Boliche</span>
            </button>
          </div>
        </header>

        {/* HERO KPIS DE PLATAFORMA */}
        <section className="px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Facturación Global */}
            <div className="bg-gradient-to-br from-gray-900/90 to-purple-950/20 border border-purple-900/30 rounded-2xl p-5">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Volumen Transaccionado</span>
                <DollarSign className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-white">
                ${globalRevenue.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                En todos los boliches adheridos
              </div>
            </div>

            {/* Comisiones SaaS Ganadas */}
            <div className="bg-gradient-to-br from-gray-900/90 to-emerald-950/20 border border-emerald-900/30 rounded-2xl p-5">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">Comisiones Ganadas</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400">
                ${globalFees.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-emerald-200/60 mt-1">
                Ingreso neto SaaS (Take-rate promedio)
              </div>
            </div>

            {/* Boliches Activos */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Boliches Activos</span>
                <Building2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {activeTenantsCount} <span className="text-sm text-gray-400 font-normal">/ {tenants.length} total</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Clubes nocturnos en producción
              </div>
            </div>

            {/* Órdenes Procesadas */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between text-gray-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Órdenes Totales</span>
                <Wine className="w-4 h-4 text-pink-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {globalOrders.toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Transacciones por Mercado Pago
              </div>
            </div>
          </div>
        </section>

        {/* LISTA Y GESTIÓN DE BOLICHES O USUARIOS */}
        <main className="px-4 md:px-8 pb-16 max-w-7xl mx-auto w-full flex-1">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-4 mb-6">
            <button
              onClick={() => setActiveSection('tenants')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeSection === 'tenants'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Boliches Adheridos ({tenants.length})</span>
            </button>

            <button
              onClick={() => setActiveSection('users')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeSection === 'users'
                  ? 'bg-pink-600/20 text-pink-300 border border-pink-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Usuarios & Roles Globales</span>
            </button>
          </div>

          {activeSection === 'users' ? (
            <UsersRoleManager
              allowSuperAdminRole={true}
              availableTenants={tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
            />
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o slug..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-900/80 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <span className="text-xs text-gray-400 font-mono self-center">
                  {filteredTenants.length} boliche(s) encontrado(s)
                </span>
              </div>

              {/* Tabla de Tenants con Acciones Completas CRUD */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider bg-gray-950/40">
                        <th className="py-3.5 px-4 font-semibold">Boliche / Slug</th>
                        <th className="py-3.5 px-4 font-semibold">Plan</th>
                        <th className="py-3.5 px-4 font-semibold">Comisión</th>
                        <th className="py-3.5 px-4 font-semibold">Órdenes</th>
                        <th className="py-3.5 px-4 font-semibold">Recaudación</th>
                        <th className="py-3.5 px-4 font-semibold">Fee SaaS</th>
                        <th className="py-3.5 px-4 font-semibold">Estado</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {filteredTenants.map((t) => (
                        <tr key={t.id} className="text-gray-300 hover:bg-gray-800/30 transition-colors">
                          {/* Boliche */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-8 rounded-full shrink-0 shadow-md"
                                style={{ backgroundColor: t.brandColor || '#8B5CF6' }}
                              />
                              <div>
                                <div className="font-bold text-white text-base flex items-center gap-2">
                                  <span>{t.name}</span>
                                  {t.totalAdmins > 0 ? (
                                    <span className="text-[10px] font-semibold text-pink-400 bg-pink-950/60 px-2 py-0.5 rounded-full border border-pink-800/40">
                                      {t.totalAdmins} admin{t.totalAdmins > 1 ? 's' : ''}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/40">
                                      Sin admins
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-purple-400 font-mono">
                                  /{t.slug}
                                  {t.domain ? <span className="text-gray-500 ml-1.5">• {t.domain}</span> : null}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-950/60 border border-purple-800/40 text-purple-300 uppercase tracking-wider">
                              {t.plan}
                            </span>
                          </td>

                          {/* Comisión */}
                          <td className="py-4 px-4 font-mono font-bold text-cyan-400">
                            {t.feePercentage}%
                          </td>

                          {/* Órdenes */}
                          <td className="py-4 px-4 text-xs">
                            <div><b className="text-white">{t.totalOrders}</b> órdenes</div>
                            <div className="text-gray-500">{t.totalProducts} tragos en carta</div>
                          </td>

                          {/* Recaudación */}
                          <td className="py-4 px-4 font-mono font-bold text-white">
                            ${t.totalRevenue.toLocaleString('es-AR')}
                          </td>

                          {/* Fee SaaS */}
                          <td className="py-4 px-4 font-mono font-bold text-emerald-400">
                            ${Math.round(t.totalFees).toLocaleString('es-AR')}
                          </td>

                          {/* Estado */}
                          <td className="py-4 px-4">
                            <button
                              onClick={() => handleToggleStatus(t)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                                t.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                              }`}
                              title="Click para cambiar estado"
                            >
                              {t.status === 'ACTIVE' ? 'Activo' : 'Suspendido'}
                            </button>
                          </td>

                          {/* Acciones */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botón Gestionar Administradores del Boliche */}
                              <button
                                onClick={() => {
                                  setManagingAdminsTenant(t)
                                  setAdminModalTab('list')
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-pink-950/40 hover:bg-pink-900/60 border border-pink-700/50 text-pink-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title={`Gestionar administradores asignados a ${t.name}`}
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                                <span>Admins ({t.totalAdmins || 0})</span>
                              </button>

                              {/* Botón Editar Boliche */}
                              <button
                                onClick={() => openEditTenant(t)}
                                className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-purple-950/60 hover:text-purple-300 border border-gray-700/60 text-gray-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Editar configuración completa del boliche"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-purple-400" />
                                <span>Editar</span>
                              </button>

                              {/* Ir a Panel Admin del Club */}
                              <Link
                                href={`/${t.slug}/admin`}
                                className="px-2.5 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/70 border border-purple-700/50 text-purple-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                                title="Panel Admin del Club"
                              >
                                <Settings className="w-3.5 h-3.5" />
                                <span>Admin</span>
                              </Link>

                              {/* Ir a Barra del Bartender */}
                              <Link
                                href={`/${t.slug}/barra`}
                                className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                                title="Barra del Bartender"
                              >
                                <Wine className="w-3.5 h-3.5 text-pink-400" />
                                <span>Barra</span>
                              </Link>

                              {/* Ver Tienda Cliente */}
                              <Link
                                href={`/${t.slug}`}
                                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                                title="Ver Carta Cliente"
                                target="_blank"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>

                              {/* Botón Borrar Boliche */}
                              <button
                                onClick={() => setDeletingTenant(t)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-colors cursor-pointer"
                                title="Eliminar boliche definitivamente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>

        {/* MODAL 1: PROVISIONAR NUEVO BOLICHE */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#12121a] border border-purple-500/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full bg-white/5 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Alta de Nuevo Boliche</h3>
                  <p className="text-xs text-gray-400">
                    Provisionamiento instantáneo multi-tenant con carta de tragos preconfigurada
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateTenant} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Nombre del Boliche *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Crobar Buenos Aires"
                      value={newName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full bg-black/40 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Nombre Tienda (Público)
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre comercial"
                      value={newNightclubName}
                      onChange={(e) => setNewNightclubName(e.target.value)}
                      className="w-full bg-black/40 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Slug URL (Único) *
                  </label>
                  <div className="flex items-center bg-black/40 border border-gray-800 rounded-xl px-4 py-2 text-sm text-gray-400 focus-within:border-purple-500">
                    <span>barraonline.com/</span>
                    <input
                      type="text"
                      required
                      placeholder="crobar-ba"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="bg-transparent text-white font-mono flex-1 focus:outline-none pl-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Comisión SaaS (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="50"
                      required
                      value={newFee}
                      onChange={(e) => setNewFee(Number(e.target.value))}
                      className="w-full bg-black/40 border border-gray-800 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Plan SaaS
                    </label>
                    <select
                      value={newPlan}
                      onChange={(e) => setNewPlan(e.target.value)}
                      className="w-full bg-black/40 border border-gray-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PRO">PRO</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Color Primario
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newBrandColor}
                        onChange={(e) => setNewBrandColor(e.target.value)}
                        className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newBrandColor}
                        onChange={(e) => setNewBrandColor(e.target.value)}
                        className="w-full bg-black/40 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Color Acento
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newAccentColor}
                        onChange={(e) => setNewAccentColor(e.target.value)}
                        className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newAccentColor}
                        onChange={(e) => setNewAccentColor(e.target.value)}
                        className="w-full bg-black/40 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Dominio Personalizado
                    </label>
                    <input
                      type="text"
                      placeholder="barra.crobar.com.ar"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      className="w-full bg-black/40 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Cierre Nocturno (QR)
                    </label>
                    <input
                      type="time"
                      value={newExpirationHour}
                      onChange={(e) => setNewExpirationHour(e.target.value)}
                      className="w-full bg-black/40 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl text-xs text-purple-300">
                  ✨ Se autogenerarán 4 tragos clásicos para que el boliche comience a vender de inmediato.
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 disabled:opacity-50 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{creating ? 'Creando Boliche...' : 'Crear y Activar'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: EDITAR BOLICHE COMPLETO */}
        {editingTenant && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#12121a] border border-purple-500/40 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => setEditingTenant(null)}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full bg-white/5 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-600/30">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Editar Configuración del Boliche</h3>
                  <p className="text-xs text-gray-400">
                    Modificá credenciales, comisiones, colores, slug e integración con pasarela de pago.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdateTenant} className="space-y-4">
                {/* Sección 1: Datos Principales */}
                <div className="p-4 rounded-2xl bg-black/40 border border-gray-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Identidad y Dirección Web</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Nombre Oficial *
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Nombre en Tienda Cliente
                      </label>
                      <input
                        type="text"
                        value={editNightclubName}
                        onChange={(e) => setEditNightclubName(e.target.value)}
                        className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Slug URL (Identificador) *
                      </label>
                      <div className="flex items-center bg-[#181822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-400 focus-within:border-purple-500">
                        <span>/</span>
                        <input
                          type="text"
                          required
                          value={editSlug}
                          onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          className="bg-transparent text-white font-mono flex-1 focus:outline-none pl-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Dominio Personalizado (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="ej: barra.crobar.com"
                        value={editDomain}
                        onChange={(e) => setEditDomain(e.target.value)}
                        className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Bajada / Eslogan
                    </label>
                    <input
                      type="text"
                      value={editTagline}
                      onChange={(e) => setEditTagline(e.target.value)}
                      placeholder="Ej: Barra Rápida QR • Cero Colas"
                      className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Sección 2: Branding y Horarios */}
                <div className="p-4 rounded-2xl bg-black/40 border border-gray-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    <span>Estética y Reglas de Corte Nocturno</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Color Primario
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editBrandColor}
                          onChange={(e) => setEditBrandColor(e.target.value)}
                          className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editBrandColor}
                          onChange={(e) => setEditBrandColor(e.target.value)}
                          className="w-full bg-[#181822] border border-gray-800 rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Color Acento
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editAccentColor}
                          onChange={(e) => setEditAccentColor(e.target.value)}
                          className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editAccentColor}
                          onChange={(e) => setEditAccentColor(e.target.value)}
                          className="w-full bg-[#181822] border border-gray-800 rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-400" />
                        <span>Cierre Nocturno</span>
                      </label>
                      <input
                        type="time"
                        value={editExpirationHour}
                        onChange={(e) => setEditExpirationHour(e.target.value)}
                        className="w-full bg-[#181822] border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 3: Reglas SaaS y Estado */}
                <div className="p-4 rounded-2xl bg-black/40 border border-gray-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5" />
                    <span>Monetización SaaS y Licencia</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Comisión Take-Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="50"
                        value={editFee}
                        onChange={(e) => setEditFee(Number(e.target.value))}
                        className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Plan Plataforma
                      </label>
                      <select
                        value={editPlan}
                        onChange={(e) => setEditPlan(e.target.value)}
                        className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3 py-2 text-sm text-white"
                      >
                        <option value="STARTER">STARTER</option>
                        <option value="PRO">PRO</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        Estado Suscripción
                      </label>
                      <select
                        value={editSubscriptionStatus}
                        onChange={(e) => setEditSubscriptionStatus(e.target.value)}
                        className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3 py-2 text-sm text-white"
                      >
                        <option value="ACTIVE">ACTIVE (Activo)</option>
                        <option value="TRIAL">TRIAL (En Prueba)</option>
                        <option value="PAST_DUE">PAST_DUE (Vencido)</option>
                        <option value="CANCELLED">CANCELLED (Cancelado)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span>Boliche habilitado para operar públicamente en la plataforma</span>
                    </label>
                  </div>
                </div>

                {/* Sección 4: Credenciales Mercado Pago */}
                <div className="p-4 rounded-2xl bg-black/40 border border-gray-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pasarela Mercado Pago (Split / Cobro Directo)</span>
                  </h4>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        MP Public Key
                      </label>
                      <input
                        type="text"
                        placeholder="APP_USR-..."
                        value={editMpPublicKey}
                        onChange={(e) => setEditMpPublicKey(e.target.value)}
                        className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        MP Access Token (Producción)
                      </label>
                      <input
                        type="password"
                        placeholder="APP_USR-..."
                        value={editMpAccessToken}
                        onChange={(e) => setEditMpAccessToken(e.target.value)}
                        className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1">
                        MP Seller ID (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="ID de vendedor de Mercado Pago"
                        value={editMpSellerId}
                        onChange={(e) => setEditMpSellerId(e.target.value)}
                        className="w-full bg-[#181822] border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 disabled:opacity-50 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{savingEdit ? 'Guardando Cambios...' : 'Guardar Todo'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: CONFIRMAR BORRADO DE BOLICHE */}
        {deletingTenant && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#141014] border border-rose-500/40 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative text-white animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-black mb-1">
                ¿Eliminar boliche definitivamente?
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">
                Estás a punto de borrar por completo <strong className="text-white">{deletingTenant.name}</strong> (/{deletingTenant.slug}).
              </p>

              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-200 mb-6 space-y-1">
                <p>⚠️ Se eliminarán todas sus órdenes, catálogo de productos y registros de rotura.</p>
                <p>👥 Los usuarios y clientes vinculados quedarán liberados como usuarios globales sin perder sus cuentas.</p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeletingTenant(null)}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteTenant}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 disabled:opacity-50 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{deleting ? 'Eliminando Boliche...' : 'Eliminar Boliche'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: GESTIONAR ADMINISTRADORES DEL BOLICHE */}
        {managingAdminsTenant && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#12121a] border border-pink-500/40 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => {
                  setManagingAdminsTenant(null)
                  setEditingAdminUser(null)
                }}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-pink-600/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    Administradores de "{managingAdminsTenant.name}"
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Asigná las cuentas de acceso con rango CLUB_ADMIN para este boliche. Ellos tendrán acceso al CRUD para sus empleados sin poder alterar permisos de administrador.
                  </p>
                </div>
              </div>

              {/* Subtabs del Modal */}
              <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAdminModalTab('list')
                    setEditingAdminUser(null)
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    adminModalTab === 'list'
                      ? 'bg-pink-600/20 text-pink-300 border border-pink-500/40 shadow-md shadow-pink-950/50'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Admins Asignados ({managingAdminsTenant.admins?.length || 0})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdminModalTab('create')
                    setEditingAdminUser(null)
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    adminModalTab === 'create'
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-950/50'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  + Crear Nueva Cuenta Admin
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdminModalTab('link')
                    setEditingAdminUser(null)
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    adminModalTab === 'link'
                      ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-950/50'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Vincular Usuario Existente
                </button>
              </div>

              {/* TAB 1: LISTA DE ADMINISTRADORES ASIGNADOS */}
              {adminModalTab === 'list' && (
                <div className="space-y-4">
                  {editingAdminUser ? (
                    /* FORMULARIO EDITAR ADMIN */
                    <form onSubmit={handleSaveAdminEdit} className="space-y-3.5 bg-gray-900/60 p-4 rounded-2xl border border-pink-900/40">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                        <span className="text-xs font-bold text-pink-300 uppercase">
                          Editar Administrador: {editingAdminUser.fullName}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingAdminUser(null)}
                          className="text-xs text-gray-400 hover:text-white cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                          Nombre Completo *
                        </label>
                        <input
                          type="text"
                          required
                          value={editAdminName}
                          onChange={(e) => setEditAdminName(e.target.value)}
                          className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                            Correo Electrónico
                          </label>
                          <input
                            type="email"
                            value={editAdminEmail}
                            onChange={(e) => setEditAdminEmail(e.target.value)}
                            className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                            Teléfono
                          </label>
                          <input
                            type="tel"
                            value={editAdminPhone}
                            onChange={(e) => setEditAdminPhone(e.target.value)}
                            className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                            DNI
                          </label>
                          <input
                            type="text"
                            value={editAdminDni}
                            onChange={(e) => setEditAdminDni(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                            Resetear Contraseña (opcional)
                          </label>
                          <input
                            type="text"
                            value={editAdminPassword}
                            onChange={(e) => setEditAdminPassword(e.target.value)}
                            placeholder="Dejar vacío si no cambia"
                            className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingAdminUser(null)}
                          className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingAdminEdit}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-lg shadow-pink-900/30"
                        >
                          {savingAdminEdit ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                      </div>
                    </form>
                  ) : (!managingAdminsTenant.admins || managingAdminsTenant.admins.length === 0) ? (
                    <div className="py-12 text-center bg-gray-900/40 rounded-2xl border border-gray-800">
                      <ShieldCheck className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-300 font-medium">Este boliche no tiene administradores asignados.</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                        Creá una cuenta de acceso para el dueño o gerente del boliche usando la pestaña "+ Crear Nueva Cuenta Admin".
                      </p>
                      <button
                        type="button"
                        onClick={() => setAdminModalTab('create')}
                        className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold cursor-pointer"
                      >
                        + Crear Primer Administrador
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {managingAdminsTenant.admins.map((adm) => (
                        <div
                          key={adm.id}
                          className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-pink-900/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{adm.fullName}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                                CLUB_ADMIN
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              {adm.email && <span>📧 {adm.email}</span>}
                              {adm.phone && <span>📱 {adm.phone}</span>}
                              {adm.dni && <span>🪪 DNI: {adm.dni}</span>}
                              <span>{adm.hasPassword ? '🔑 Clave activa' : 'Sin clave'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAdminUser(adm)
                                setEditAdminName(adm.fullName)
                                setEditAdminEmail(adm.email || '')
                                setEditAdminPhone(adm.phone || '')
                                setEditAdminDni(adm.dni || '')
                                setEditAdminPassword('')
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Editar datos o resetear contraseña"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-pink-400" />
                              <span>Editar / Clave</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRevokeAdmin(adm.id, adm.fullName)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Revocar rango de administrador"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Quitar Admin</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CREAR NUEVO ADMINISTRADOR DIRECTO */}
              {adminModalTab === 'create' && (
                <form onSubmit={handleCreateTenantAdmin} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-800/40 text-xs text-purple-200">
                    💡 La cuenta creada tendrá rango <b>CLUB_ADMIN</b> vinculada a <b>{managingAdminsTenant.name}</b>. Podrá iniciar sesión con su correo/DNI y contraseña para administrar el boliche y a sus bartenders.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      placeholder="Ej: Marcelo Gómez (Gerente)"
                      className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                        Correo de Acceso *
                      </label>
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="marcelo@boliche.com"
                        className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                        Contraseña de Acceso *
                      </label>
                      <input
                        type="text"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                        Teléfono (Opcional)
                      </label>
                      <input
                        type="tel"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        placeholder="1123456789"
                        className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                        DNI (Opcional)
                      </label>
                      <input
                        type="text"
                        value={adminDni}
                        onChange={(e) => setAdminDni(e.target.value.replace(/\D/g, ''))}
                        placeholder="DNI"
                        className="w-full bg-black/40 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                    <button
                      type="button"
                      onClick={() => setAdminModalTab('list')}
                      className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={creatingAdmin}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-lg shadow-pink-900/30 flex items-center gap-2"
                    >
                      {creatingAdmin && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{creatingAdmin ? 'Creando Administrador...' : 'Crear Cuenta & Asignar Admin'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: VINCULAR USUARIO EXISTENTE */}
              {adminModalTab === 'link' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200">
                    🔍 Buscá cualquier usuario registrado (por nombre, correo o DNI) y promové su cuenta al rango <b>CLUB_ADMIN</b> de este boliche con un solo clic.
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={linkSearchQuery}
                      onChange={(e) => searchUsersToLink(e.target.value)}
                      placeholder="Buscar por correo, nombre o DNI..."
                      className="w-full bg-black/40 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {searchingUsers ? (
                    <div className="py-8 text-center text-xs text-gray-500">Buscando usuarios...</div>
                  ) : linkSearchResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-500">
                      {linkSearchQuery.length >= 2
                        ? 'No se encontraron usuarios coincidentes.'
                        : 'Escribí al menos 2 letras para buscar.'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {linkSearchResults.map((u) => (
                        <div
                          key={u.id}
                          className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-bold text-white text-sm">{u.fullName}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                              <span>{u.email || u.phone || u.dni || 'Sin contacto'}</span>
                              <span className="text-[10px] text-gray-500 uppercase">({u.role})</span>
                              {u.tenantName && (
                                <span className="text-[10px] text-purple-400">[{u.tenantName}]</span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={linkingUser}
                            onClick={() => handleLinkExistingUser(u.id, u.fullName)}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold cursor-pointer transition-all shadow-md shadow-cyan-950/40"
                          >
                            Asignar como Admin
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
