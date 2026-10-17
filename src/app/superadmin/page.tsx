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
} from 'lucide-react'

interface TenantSummary {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  brandColor: string
  accentColor: string
  feePercentage: number
  totalOrders: number
  totalProducts: number
  totalStaff: number
  totalRevenue: number
  totalFees: number
  createdAt: string
}

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal para crear boliche
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newFee, setNewFee] = useState(5.0)
  const [newPlan, setNewPlan] = useState('PRO')
  const [newBrandColor, setNewBrandColor] = useState('#8B5CF6')
  const [newAccentColor, setNewAccentColor] = useState('#EC4899')
  const [creating, setCreating] = useState(false)

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

  // Auto-slug a partir del nombre
  const handleNameChange = (val: string) => {
    setNewName(val)
    const slugified = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setNewSlug(slugified)
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
          feePercentage: newFee,
          plan: newPlan,
          brandColor: newBrandColor,
          accentColor: newAccentColor,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Boliche "${newName}" provisionado con éxito`)
        setShowCreateModal(false)
        setNewName('')
        setNewSlug('')
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

  // Cambiar estado activo/suspendido
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
              Control centralizado multi-tenant y liquidación de comisiones SaaS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchTenants(true)}
            disabled={refreshing}
            className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-xs font-medium flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span>Refrescar</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all"
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

      {/* LISTA Y GESTIÓN DE BOLICHES */}
      <main className="px-4 md:px-8 pb-16 max-w-7xl mx-auto w-full flex-1">
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

        {/* Tabla de Tenants */}
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
                  <th className="py-3.5 px-4 font-semibold text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="text-gray-300 hover:bg-gray-800/30 transition-colors">
                    {/* Boliche */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: t.brandColor || '#8B5CF6' }}
                        />
                        <div>
                          <div className="font-bold text-white text-base">{t.name}</div>
                          <div className="text-xs text-purple-400 font-mono">/{t.slug}</div>
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-950/60 border border-purple-800/40 text-purple-300">
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
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
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
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/${t.slug}/admin`}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/70 border border-purple-700/50 text-purple-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Panel Admin del Club"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Admin</span>
                        </Link>

                        <Link
                          href={`/${t.slug}/barra`}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Barra del Bartender"
                        >
                          <Wine className="w-3.5 h-3.5" />
                          <span>Barra</span>
                        </Link>

                        <Link
                          href={`/${t.slug}`}
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Ver Carta Cliente"
                          target="_blank"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL: PROVISIONAR NUEVO BOLICHE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-purple-500/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Alta de Nuevo Boliche</h3>
                <p className="text-xs text-gray-400">
                  Provisionamiento instantáneo con carta de tragos preconfigurada
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Nombre del Boliche *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Crobar Buenos Aires"
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Slug URL (Único) *
                </label>
                <div className="flex items-center bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-sm text-gray-400 focus-within:border-purple-500">
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
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
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
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Plan
                  </label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="STARTER">STARTER</option>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
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
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
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
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl text-xs text-purple-300">
                ✨ Se auto-crearán 4 tragos clásicos argentinos (Fernet con Coca, Gin Tonic, Cerveza Corona y Vodka Speed) para que el club pueda comenzar a vender inmediatamente.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 disabled:opacity-50"
                >
                  {creating ? 'Creando Boliche...' : 'Crear y Activar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
