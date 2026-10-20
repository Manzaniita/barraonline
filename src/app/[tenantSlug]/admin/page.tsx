'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  DollarSign,
  TrendingUp,
  Wine,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
  Search,
  Filter,
  Flame,
  ArrowLeft,
  GlassWater,
  ShieldAlert,
  Edit2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  ChevronRight,
  PlusCircle,
  FileSpreadsheet,
  Activity,
  BarChart3,
  Layers,
  Sparkles,
  Zap,
  Users,
  UserCheck,
  Trash2,
  Settings,
  Palette,
  CreditCard,
  Image as ImageIcon,
  X,
} from 'lucide-react'
import { ClubNightMetrics, ProductPerformance } from '@/lib/admin-service'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { UsersRoleManager } from '@/components/admin/UsersRoleManager'

export default function ClubAdminPage() {
  const params = useParams()
  const tenantSlug = typeof params?.tenantSlug === 'string' ? params.tenantSlug : ''

  const [metrics, setMetrics] = useState<ClubNightMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'catalog' | 'breakages' | 'orders' | 'users' | 'settings'>('catalog')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null)

  // Modal para crear producto nuevo
  const [showCreateProductModal, setShowCreateProductModal] = useState(false)
  const [newProdName, setNewProdName] = useState('')
  const [newProdCategory, setNewProdCategory] = useState('Tragos')
  const [newProdDescription, setNewProdDescription] = useState('')
  const [newProdPrice, setNewProdPrice] = useState<number>(5000)
  const [newProdStock, setNewProdStock] = useState<number>(100)
  const [newProdImageUrl, setNewProdImageUrl] = useState('')
  const [newProdDeadline, setNewProdDeadline] = useState('')
  const [newProdIsActive, setNewProdIsActive] = useState(true)
  const [creatingProduct, setCreatingProduct] = useState(false)

  // Modal para editar producto completo
  const [editingProduct, setEditingProduct] = useState<ProductPerformance | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPrice, setEditPrice] = useState<number>(0)
  const [editStock, setEditStock] = useState<number>(0)
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [savingEdit, setSavingEdit] = useState(false)

  // Modal para eliminar producto
  const [deletingProduct, setDeletingProduct] = useState<ProductPerformance | null>(null)
  const [deletingProdLoading, setDeletingProdLoading] = useState(false)

  // Configuración editable de la tienda
  const [storeName, setStoreName] = useState('')
  const [storeNightclubName, setStoreNightclubName] = useState('')
  const [storeTagline, setStoreTagline] = useState('')
  const [storeSearchPlaceholder, setStoreSearchPlaceholder] = useState('')
  const [storeLogoUrl, setStoreLogoUrl] = useState('')
  const [storePrimaryColor, setStorePrimaryColor] = useState('#9333ea')
  const [storeSecondaryColor, setStoreSecondaryColor] = useState('#ec4899')
  const [storeBgColor, setStoreBgColor] = useState('#0a0a0c')
  const [storeCardColor, setStoreCardColor] = useState('#12121a')
  const [storeExpirationHour, setStoreExpirationHour] = useState('07:00')
  const [storeMpSellerId, setStoreMpSellerId] = useState('')
  const [storeMpPublicKey, setStoreMpPublicKey] = useState('')
  const [storeMpAccessToken, setStoreMpAccessToken] = useState('')
  const [storeMpWebhookSecret, setStoreMpWebhookSecret] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const settingsInitializedRef = useRef(false)
  const [verifyingMp, setVerifyingMp] = useState(false)
  const [mpVerifyResult, setMpVerifyResult] = useState<{
    valid: boolean
    account?: {
      sellerId: string
      nickname: string
      email: string
      firstName: string
      lastName: string
      countryId: string
      siteId: string
      mode: 'PRODUCTION' | 'SANDBOX'
    }
    error?: string
  } | null>(null)

  // Modal para registrar rotura
  const [showBreakageModal, setShowBreakageModal] = useState(false)
  const [breakageProductId, setBreakageProductId] = useState('')
  const [breakageQty, setBreakageQty] = useState(1)
  const [breakageReason, setBreakageReason] = useState('BOTELLA_ROTA')
  const [breakageCost, setBreakageCost] = useState('')
  const [breakageNotes, setBreakageNotes] = useState('')
  const [savingBreakage, setSavingBreakage] = useState(false)

  // Notificación toast rápida
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  const fetchMetrics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/admin/metrics?tenantSlug=${tenantSlug}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (data.success && data.metrics) {
        setMetrics(data.metrics)
        if (!settingsInitializedRef.current && data.metrics.tenantSettings) {
          const ts = data.metrics.tenantSettings
          setStoreName(ts.name || '')
          setStoreNightclubName(ts.themeConfig?.nightclubName || ts.name || '')
          setStoreTagline(ts.themeConfig?.tagline || '')
          setStoreSearchPlaceholder(ts.themeConfig?.searchPlaceholder || '')
          setStoreLogoUrl(ts.themeConfig?.logoUrl || '')
          setStorePrimaryColor(ts.themeConfig?.primaryColor || '#9333ea')
          setStoreSecondaryColor(ts.themeConfig?.secondaryColor || '#ec4899')
          setStoreBgColor(ts.themeConfig?.backgroundColor || '#0a0a0c')
          setStoreCardColor(ts.themeConfig?.cardBackground || '#12121a')
          setStoreExpirationHour(ts.defaultExpirationHour || '07:00')
          setStoreMpSellerId(ts.mpSellerId || '')
          setStoreMpPublicKey(ts.mpPublicKey || '')
          settingsInitializedRef.current = true
        }
      } else {
        showToast(data.error || 'No se pudieron cargar las métricas', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Error de conexión al cargar métricas', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tenantSlug])

  useEffect(() => {
    fetchMetrics()
    // Auto-refresco cada 20 segundos para monitoreo en vivo de la noche
    const interval = setInterval(() => {
      fetchMetrics()
    }, 20000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  // Pausar o Activar Trago
  const handleToggleProduct = async (product: ProductPerformance) => {
    setUpdatingProductId(product.id)
    const newStatus = !product.isActive

    // Actualización optimista local
    setMetrics((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        products: prev.products.map((p) =>
          p.id === product.id ? { ...p, isActive: newStatus } : p
        ),
      }
    })

    try {
      const res = await fetch('/api/admin/products/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          isActive: newStatus,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(
          `${product.name} ${newStatus ? 'activado en carta' : 'pausado al público'}`
        )
      } else {
        // Revertir optimismo
        fetchMetrics()
        showToast(data.error || 'Error al actualizar estado', 'error')
      }
    } catch (err) {
      fetchMetrics()
      showToast('Error de conexión', 'error')
    } finally {
      setUpdatingProductId(null)
    }
  }

  // Crear producto nuevo
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProdName.trim()) {
      showToast('El nombre del producto es obligatorio', 'error')
      return
    }

    setCreatingProduct(true)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          name: newProdName.trim(),
          category: newProdCategory.trim() || 'Tragos',
          description: newProdDescription.trim() || null,
          price: Number(newProdPrice),
          stockAvailable: Number(newProdStock),
          imageUrl: newProdImageUrl.trim() || null,
          redeemDeadlineTime: newProdDeadline.trim() || null,
          isActive: newProdIsActive,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Producto "${newProdName}" creado con éxito`)
        setShowCreateProductModal(false)
        setNewProdName('')
        setNewProdDescription('')
        setNewProdImageUrl('')
        setNewProdDeadline('')
        setNewProdPrice(5000)
        setNewProdStock(100)
        setNewProdIsActive(true)
        fetchMetrics()
      } else {
        showToast(data.error || 'Error al crear producto', 'error')
      }
    } catch {
      showToast('Error de conexión al crear producto', 'error')
    } finally {
      setCreatingProduct(false)
    }
  }

  // Abrir modal de edición completa de producto
  const openEditProductModal = (product: ProductPerformance) => {
    setEditingProduct(product)
    setEditName(product.name)
    setEditCategory(product.category)
    setEditDescription(product.description || '')
    setEditPrice(product.price)
    setEditStock(product.stockAvailable)
    setEditImageUrl(product.imageUrl || '')
    setEditDeadline(product.redeemDeadlineTime || '')
    setEditIsActive(product.isActive)
  }

  // Guardar edición completa de producto
  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    setSavingEdit(true)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: editingProduct.id,
          tenantSlug,
          name: editName.trim(),
          category: editCategory.trim() || 'Tragos',
          description: editDescription.trim() || null,
          price: Number(editPrice),
          stockAvailable: Number(editStock),
          imageUrl: editImageUrl.trim() || null,
          redeemDeadlineTime: editDeadline.trim() || null,
          isActive: editIsActive,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Producto "${editName}" actualizado`)
        setEditingProduct(null)
        fetchMetrics()
      } else {
        showToast(data.error || 'Error actualizando producto', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  // Eliminar producto permanentemente
  const handleDeleteProduct = async () => {
    if (!deletingProduct) return

    setDeletingProdLoading(true)
    try {
      const res = await fetch(
        `/api/admin/products?productId=${deletingProduct.id}&tenantSlug=${tenantSlug}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (data.success) {
        showToast(`Producto "${deletingProduct.name}" eliminado permanentemente`)
        setDeletingProduct(null)
        if (editingProduct?.id === deletingProduct.id) {
          setEditingProduct(null)
        }
        fetchMetrics()
      } else {
        showToast(data.error || 'Error al eliminar producto', 'error')
      }
    } catch {
      showToast('Error de conexión al eliminar producto', 'error')
    } finally {
      setDeletingProdLoading(false)
    }
  }

  // Guardar configuración de la tienda
  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          name: storeName.trim(),
          defaultExpirationHour: storeExpirationHour.trim() || '07:00',
          mpSellerId: storeMpSellerId.trim() || null,
          mpPublicKey: storeMpPublicKey.trim() || null,
          mpAccessTokenEnc: storeMpAccessToken.trim() || undefined,
          mpWebhookSecret: storeMpWebhookSecret.trim() || undefined,
          themeConfig: {
            nightclubName: storeNightclubName.trim() || storeName.trim(),
            tagline: storeTagline.trim(),
            searchPlaceholder: storeSearchPlaceholder.trim(),
            logoUrl: storeLogoUrl.trim(),
            primaryColor: storePrimaryColor,
            secondaryColor: storeSecondaryColor,
            backgroundColor: storeBgColor,
            cardBackground: storeCardColor,
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Configuración de la tienda guardada con éxito')
        setStoreMpAccessToken('')
        setStoreMpWebhookSecret('')
        fetchMetrics(true)
      } else {
        showToast(data.error || 'Error guardando configuración', 'error')
      }
    } catch {
      showToast('Error de conexión al guardar configuración', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  // Verificar credenciales de Mercado Pago en vivo
  const handleVerifyMpConnection = async () => {
    setVerifyingMp(true)
    setMpVerifyResult(null)
    try {
      const res = await fetch('/api/admin/settings/verify-mp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          accessToken: storeMpAccessToken.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success && data.valid && data.account) {
        setMpVerifyResult({ valid: true, account: data.account })
        if (!storeMpSellerId.trim() && data.account.sellerId) {
          setStoreMpSellerId(data.account.sellerId)
        }
        showToast(
          `Conexión verificada con Mercado Pago (${data.account.nickname || data.account.email}) [${data.account.mode}]`
        )
      } else {
        setMpVerifyResult({
          valid: false,
          error: data.error || 'No se pudo validar el Access Token con Mercado Pago.',
        })
        showToast(data.error || 'Token de Mercado Pago inválido', 'error')
      }
    } catch {
      setMpVerifyResult({
        valid: false,
        error: 'Error de red intentando contactar a Mercado Pago.',
      })
      showToast('Error de red al verificar Mercado Pago', 'error')
    } finally {
      setVerifyingMp(false)
    }
  }

  // Guardar rotura / merma
  const handleSaveBreakage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!breakageProductId) {
      showToast('Seleccioná el producto afectado', 'error')
      return
    }

    setSavingBreakage(true)
    try {
      const res = await fetch('/api/admin/breakages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          productId: breakageProductId,
          quantity: breakageQty,
          reason: breakageReason,
          costEstimate: breakageCost ? Number(breakageCost) : undefined,
          notes: breakageNotes,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Merma / rotura registrada con éxito')
        setShowBreakageModal(false)
        setBreakageQty(1)
        setBreakageNotes('')
        setBreakageCost('')
        fetchMetrics()
      } else {
        showToast(data.error || 'Error registrando merma', 'error')
      }
    } catch (err) {
      showToast('Error de conexión', 'error')
    } finally {
      setSavingBreakage(false)
    }
  }

  // Filtrado de tragos
  const filteredProducts = (metrics?.products || []).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter
    return matchesSearch && matchesCat
  })

  const uniqueCategories = Array.from(
    new Set((metrics?.products || []).map((p) => p.category))
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080c] text-white flex flex-col items-center justify-center p-6">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-ping" />
          <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-pink-500 border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
        </div>
        <p className="text-gray-400 font-mono tracking-widest text-sm uppercase">
          Cargando telemetría del boliche...
        </p>
      </div>
    )
  }

  return (
    <RoleGuard
      allowedRoles={['CLUB_ADMIN', 'SUPER_ADMIN']}
      sectionTitle="Panel Club Admin"
      tenantSlug={tenantSlug}
    >
      <div className="min-h-screen bg-[#07070b] text-gray-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
        {/* Toast flotante */}
        {toastMessage && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{toastMessage.text}</span>
          </div>
        )}

        {/* HEADER DE CONTROL */}
        <header className="sticky top-0 z-40 bg-[#0a0a10]/90 backdrop-blur-md border-b border-purple-900/30 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/${tenantSlug}`}
              className="p-2 bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-800"
              title="Ver Menú Cliente"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-black tracking-tight text-white">
                  {metrics?.tenantName || 'Panel Club Admin'}
                </span>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Noche Activa
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Gestión de Carta, Stock, Mermas y Roles • Slug:{' '}
                <span className="text-purple-400 font-mono">/{tenantSlug}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/${tenantSlug}/mi-cuenta`}
              className="px-3 py-2 rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-purple-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Mi Cuenta"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mi Cuenta</span>
            </Link>

            <button
              onClick={() => fetchMetrics(true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              title="Refrescar métricas ahora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>

            <a
              href={`/api/admin/export-csv?tenantSlug=${tenantSlug}`}
              download
              className="px-3.5 py-2 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/40 text-purple-300 hover:text-purple-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-950/50"
              title="Descargar Reporte CSV de Auditoría"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Cierre Nocturno (.CSV)</span>
            </a>

            <Link
              href={`/${tenantSlug}/barra`}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-600/30"
            >
              <Wine className="w-3.5 h-3.5" />
              <span>Abrir Barra</span>
            </Link>
          </div>
        </header>

      {/* ALERTA DE MERCADO PAGO NO CONFIGURADO */}
      {metrics?.tenantSettings && !metrics.tenantSettings.hasMpAccessToken && (
        <div className="px-4 md:px-8 pt-5 max-w-7xl mx-auto w-full">
          <div className="bg-amber-950/50 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-200 flex items-center gap-2">
                  Cobros Desactivados: Falta vincular Mercado Pago
                </h3>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Para que tus clientes puedan comprar bebidas desde la tienda digital y recibir su código QR, debés cargar el <span className="font-mono font-bold text-white">Access Token</span> de tu cuenta de Mercado Pago.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs whitespace-nowrap transition-all shadow-lg shadow-amber-500/20"
            >
              Configurar Mercado Pago →
            </button>
          </div>
        </div>
      )}

      {/* METRICAS KPI HERO */}
      <section className="px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {/* 1. Recaudación Total */}
          <div className="bg-gradient-to-br from-gray-900/90 to-purple-950/20 border border-purple-900/30 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Recaudación</span>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white tracking-tight">
                ${(metrics?.totalRevenue || 0).toLocaleString('es-AR')}
              </div>
              <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                <span className="text-purple-400 font-semibold">{metrics?.totalOrdersCount || 0}</span> órdenes
              </div>
            </div>
          </div>

          {/* 2. Bebidas Vendidas */}
          <div className="bg-gray-900/80 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Vendidas</span>
              <Wine className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-white tracking-tight">
                {metrics?.totalDrinksPurchased || 0}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">unidades cobradas</div>
            </div>
          </div>

          {/* 3. Bebidas Despachadas */}
          <div className="bg-gray-900/80 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Despachadas</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400 tracking-tight">
                {metrics?.totalDrinksRedeemed || 0}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">servidas en barra</div>
            </div>
          </div>

          {/* 4. Saldo Pendiente (Liability) */}
          <div className="bg-gray-900/80 border border-amber-900/30 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-amber-300/80">En Mano Clientes</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-amber-400 tracking-tight">
                {metrics?.totalDrinksPending || 0}
              </div>
              <div className="text-[11px] text-amber-200/60 mt-1">por retirar antes de 7am</div>
            </div>
          </div>

          {/* 5. Tasa de Canje */}
          <div className="bg-gray-900/80 border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Tasa Canje</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-cyan-400 tracking-tight">
                {metrics?.redemptionRatePercentage || 0}%
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metrics?.redemptionRatePercentage || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* 6. Mermas y Roturas */}
          <div className="bg-gray-900/80 border border-rose-900/30 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-rose-300/80">Roturas Noche</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-rose-400 tracking-tight">
                {metrics?.breakageCount || 0}{' '}
                <span className="text-xs text-rose-300/60 font-normal">u.</span>
              </div>
              <div className="text-[11px] text-rose-300/70 mt-1">
                ${(metrics?.breakageCost || 0).toLocaleString('es-AR')} costo est.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PESTAÑAS DE CONTROL */}
      <main className="px-4 md:px-8 pb-16 max-w-7xl mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-800 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center gap-2 ${
                activeTab === 'catalog'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/50 shadow-lg shadow-purple-950/40'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Control de Carta en Vivo ({metrics?.products?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('breakages')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center gap-2 ${
                activeTab === 'breakages'
                  ? 'bg-rose-600/20 text-rose-300 border border-rose-500/50 shadow-lg shadow-rose-950/40'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Cierre de Noche & Roturas ({metrics?.breakages?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-950/40'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Órdenes Recientes & Categorías</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'bg-pink-600/20 text-pink-300 border border-pink-500/50 shadow-lg shadow-pink-950/40'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Usuarios & Permisos (CRUD)</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-950/40'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configuración de Tienda</span>
            </button>
          </div>
        </div>

        {/* CONTENIDO TAB 1: CONTROL DE CARTA EN VIVO */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            {/* Barra de Filtros, Búsqueda y Alta de Producto */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-gray-900/50 p-3 rounded-2xl border border-gray-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o categoría..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    categoryFilter === 'ALL'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Todas
                </button>
                {uniqueCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      categoryFilter === cat
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowCreateProductModal(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 shrink-0 cursor-pointer active:scale-95 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuevo Producto</span>
              </button>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center space-y-3">
                <Wine className="w-10 h-10 text-purple-400 mx-auto opacity-60" />
                <h3 className="text-base font-bold text-white">No hay productos en esta vista</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Agregá productos a la carta de tu tienda haciendo clic en &ldquo;Nuevo Producto&rdquo;.
                </p>
                <button
                  onClick={() => setShowCreateProductModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Crear Primer Producto</span>
                </button>
              </div>
            ) : null}

            {/* Grid de Tragos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const isUpdating = updatingProductId === product.id
                return (
                  <div
                    key={product.id}
                    className={`bg-gray-900/80 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                      product.isActive
                        ? 'border-purple-900/30 hover:border-purple-500/40 shadow-lg shadow-black/40'
                        : 'border-red-950/40 bg-gray-950/60 opacity-80'
                    }`}
                  >
                    <div>
                      {/* Cabecera del trago */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/40 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                            {product.category}
                          </span>
                          <h3 className="text-base font-bold text-white mt-1.5 flex items-center gap-2">
                            {product.name}
                          </h3>
                        </div>

                        {/* Botón switch ON/OFF */}
                        <button
                          onClick={() => handleToggleProduct(product)}
                          disabled={isUpdating}
                          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            product.isActive ? 'bg-emerald-500' : 'bg-gray-800'
                          } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                          title={product.isActive ? 'Click para pausar trago' : 'Click para activar trago'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              product.isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Estado y Precio */}
                      <div className="flex items-center justify-between text-sm py-2 border-y border-gray-800/60 my-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-gray-400 text-xs">Precio:</span>
                          <span className="text-lg font-black text-white">
                            ${product.price.toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {product.isActive ? (
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              En Carta
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-rose-400" />
                              Pausado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Telemetría del Trago en la Noche */}
                      <div className="grid grid-cols-3 gap-2 py-2 bg-gray-950/60 rounded-xl px-3 border border-gray-800/60 text-center">
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase font-semibold">Vendidos</div>
                          <div className="text-sm font-black text-purple-400">{product.purchasedCount}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase font-semibold">Entregados</div>
                          <div className="text-sm font-black text-emerald-400">{product.redeemedCount}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase font-semibold">En Mano</div>
                          <div className="text-sm font-black text-amber-400">{product.remainingCount}</div>
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center justify-between pt-4 mt-3 border-t border-gray-800/40">
                      <span className="text-xs text-gray-400">
                        Stock disp.: <b className="text-gray-200">{product.stockAvailable}</b>
                        {product.redeemDeadlineTime ? (
                          <span className="ml-2 text-amber-400 font-mono">• Promo {product.redeemDeadlineTime}</span>
                        ) : null}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditProductModal(product)}
                          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-gray-700 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-purple-400" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => setDeletingProduct(product)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                          title="Eliminar producto permanentemente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CONTENIDO TAB 2: CIERRE DE NOCHE & ROTURAS */}
        {activeTab === 'breakages' && (
          <div className="space-y-6">
            {/* Banner de Auditoría Nocturna */}
            <div className="bg-gradient-to-r from-purple-950/60 via-gray-900 to-pink-950/40 border border-purple-500/30 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
              <div>
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-500/40">
                  Conciliación Contable Nocturna
                </span>
                <h2 className="text-2xl font-black text-white mt-2">
                  Auditoría y Exportación de Cierre
                </h2>
                <p className="text-sm text-gray-300 max-w-xl mt-1">
                  Generá el balance formal al finalizar la noche. Incluye recaudación total por Mercado Pago, desglose por producto, tragos cobrados vs entregados y registro de mermas/roturas para reposición de stock.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
                <button
                  onClick={() => setShowBreakageModal(true)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all"
                >
                  <PlusCircle className="w-4 h-4 text-rose-400" />
                  <span>Registrar Rotura / Merma</span>
                </button>

                <a
                  href={`/api/admin/export-csv?tenantSlug=${tenantSlug}`}
                  download
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Descargar Cierre Nocturno (.CSV)</span>
                </a>
              </div>
            </div>

            {/* Desglose de Saldo y Responsabilidad */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
                  Ganancia Neta por Tragos No Retirados
                </div>
                <div className="text-xl font-black text-amber-400">
                  {metrics?.totalDrinksPending || 0} tragos pendientes
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  A las 07:00 AM los QR expiran. Todo trago no canjeado queda en caja como ingreso sin costo de insumos.
                </p>
              </div>

              <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
                  Eficacia de Despacho en Barra
                </div>
                <div className="text-xl font-black text-emerald-400">
                  {metrics?.redemptionRatePercentage || 0}% de bebidas entregadas
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {metrics?.totalDrinksRedeemed || 0} de {metrics?.totalDrinksPurchased || 0} bebidas retiradas por los clientes.
                </p>
              </div>

              <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
                  Pérdidas Registradas por Merma
                </div>
                <div className="text-xl font-black text-rose-400">
                  ${(metrics?.breakageCost || 0).toLocaleString('es-AR')} ARS
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Total de {metrics?.breakageCount || 0} unidades declaradas como botella rota o derrame.
                </p>
              </div>
            </div>

            {/* Tabla de Roturas y Mermas */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                  Registro Histórico de Mermas de la Noche
                </h3>
                <span className="text-xs text-gray-400">
                  Total: {metrics?.breakages?.length || 0} registros
                </span>
              </div>

              {(!metrics?.breakages || metrics.breakages.length === 0) ? (
                <div className="text-center py-12 text-gray-500">
                  <GlassWater className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay roturas ni mermas registradas para esta noche.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Hora</th>
                        <th className="pb-3 font-semibold">Producto</th>
                        <th className="pb-3 font-semibold">Cant.</th>
                        <th className="pb-3 font-semibold">Motivo</th>
                        <th className="pb-3 font-semibold">Notas</th>
                        <th className="pb-3 font-semibold text-right">Costo Est.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {metrics.breakages.map((b) => (
                        <tr key={b.id} className="text-gray-300 hover:bg-gray-800/30">
                          <td className="py-3 text-xs text-gray-400 font-mono">
                            {new Date(b.createdAt).toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 font-bold text-white">{b.productName}</td>
                          <td className="py-3 font-bold text-rose-400">{b.quantity} u.</td>
                          <td className="py-3 text-xs">
                            <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                              {b.reason}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-gray-400">{b.notes || '-'}</td>
                          <td className="py-3 text-xs font-mono font-bold text-right text-gray-200">
                            ${(b.costEstimate || 0).toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTENIDO TAB 3: ÓRDENES RECIENTES & CATEGORÍAS */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Categorías */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics?.categories.map((c) => (
                <div
                  key={c.category}
                  className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5"
                >
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      {c.category}
                    </span>
                    <Layers className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-xl font-black text-white">
                    ${c.totalRevenue.toLocaleString('es-AR')}
                  </div>
                  <div className="text-xs text-gray-400 mt-2 flex justify-between">
                    <span>Vendidos: <b>{c.totalPurchased}</b></span>
                    <span>Canjeados: <b className="text-emerald-400">{c.totalRedeemed}</b></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabla de Órdenes Recientes */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Últimas Órdenes Registradas en Vivo
                </h3>
                <span className="text-xs text-gray-400">
                  Mostrando últimas {metrics?.recentOrders?.length || 0} compras
                </span>
              </div>

              {(!metrics?.recentOrders || metrics.recentOrders.length === 0) ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aún no hay compras registradas para esta noche.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="pb-3 font-semibold">Hora</th>
                        <th className="pb-3 font-semibold">Cliente</th>
                        <th className="pb-3 font-semibold">DNI</th>
                        <th className="pb-3 font-semibold">Tragos</th>
                        <th className="pb-3 font-semibold">Monto</th>
                        <th className="pb-3 font-semibold text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {metrics.recentOrders.map((o) => (
                        <tr key={o.id} className="text-gray-300 hover:bg-gray-800/30">
                          <td className="py-3 text-xs text-gray-400 font-mono">
                            {new Date(o.createdAt).toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="py-3 font-bold text-white">{o.customerName}</td>
                          <td className="py-3 text-xs font-mono text-purple-300">{o.customerDni}</td>
                          <td className="py-3 text-xs">{o.itemsCount} u.</td>
                          <td className="py-3 font-mono font-bold text-white">
                            ${o.totalAmount.toLocaleString('es-AR')}
                          </td>
                          <td className="py-3 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                                o.status === 'ACTIVE'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : o.status === 'DEPLETED'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              {o.status === 'ACTIVE' ? 'CANJE PENDIENTE' : o.status === 'DEPLETED' ? 'COMPLETADO' : o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTENIDO TAB 4: EQUIPO & ROLES (USUARIOS) */}
        {activeTab === 'users' && (
          <UsersRoleManager tenantSlug={tenantSlug} allowSuperAdminRole={false} isSuperAdmin={false} />
        )}

        {/* CONTENIDO TAB 5: CONFIGURACIÓN DE LA TIENDA */}
        {activeTab === 'settings' && (
          <form
            onSubmit={handleSaveStoreSettings}
            className="bg-gray-900/70 border border-gray-800 rounded-3xl p-6 md:p-8 space-y-8 shadow-2xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-800">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-amber-400" />
                  Configuración Integral de la Tienda
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Personalizá nombre, textos, colores, horario de corte de QRs y credenciales de Mercado Pago. Todo es 100% configurable.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {savingSettings ? 'Guardando Configuración...' : 'Guardar Configuración'}
              </button>
            </div>

            {/* 1. Identidad y Textos */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Identidad, Textos y Horario de Cierre
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Nombre Comercial de la Tienda *
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ej: Club Crobar"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Título en Cabecera de Carta
                  </label>
                  <input
                    type="text"
                    value={storeNightclubName}
                    onChange={(e) => setStoreNightclubName(e.target.value)}
                    placeholder="Ej: CROBAR VIP BAR"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Hora de Expiración de QRs (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={storeExpirationHour}
                    onChange={(e) => setStoreExpirationHour(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Subtítulo / Eslogan de Cabecera
                  </label>
                  <input
                    type="text"
                    value={storeTagline}
                    onChange={(e) => setStoreTagline(e.target.value)}
                    placeholder="Ej: Pedí desde tu mesa • Retirá sin fila"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Placeholder del Buscador
                  </label>
                  <input
                    type="text"
                    value={storeSearchPlaceholder}
                    onChange={(e) => setStoreSearchPlaceholder(e.target.value)}
                    placeholder="Ej: Buscá tu trago, botella o combo..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    URL de Logo (Opcional)
                  </label>
                  <input
                    type="url"
                    value={storeLogoUrl}
                    onChange={(e) => setStoreLogoUrl(e.target.value)}
                    placeholder="https://.../logo.png"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. Paleta de Colores Personalizable */}
            <div className="space-y-4 pt-4 border-t border-gray-800">
              <h3 className="text-sm font-bold text-pink-300 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Estética y Colores de la Carta
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Color Primario
                  </label>
                  <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl p-2">
                    <input
                      type="color"
                      value={storePrimaryColor}
                      onChange={(e) => setStorePrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={storePrimaryColor}
                      onChange={(e) => setStorePrimaryColor(e.target.value)}
                      className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Color Secundario / Acento
                  </label>
                  <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl p-2">
                    <input
                      type="color"
                      value={storeSecondaryColor}
                      onChange={(e) => setStoreSecondaryColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={storeSecondaryColor}
                      onChange={(e) => setStoreSecondaryColor(e.target.value)}
                      className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Fondo General
                  </label>
                  <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl p-2">
                    <input
                      type="color"
                      value={storeBgColor}
                      onChange={(e) => setStoreBgColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={storeBgColor}
                      onChange={(e) => setStoreBgColor(e.target.value)}
                      className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Fondo de Tarjetas
                  </label>
                  <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl p-2">
                    <input
                      type="color"
                      value={storeCardColor}
                      onChange={(e) => setStoreCardColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={storeCardColor}
                      onChange={(e) => setStoreCardColor(e.target.value)}
                      className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Credenciales de Mercado Pago */}
            <div className="space-y-4 pt-4 border-t border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Integración Mercado Pago (Cobros en la Tienda)
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Obtené tus credenciales en{' '}
                    <a
                      href="https://www.mercadopago.com.ar/developers/panel/app"
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      Mercado Pago Developers (Tus integraciones → Credenciales de producción)
                    </a>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                      metrics?.tenantSettings?.hasMpAccessToken
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    {metrics?.tenantSettings?.hasMpAccessToken
                      ? '✓ Mercado Pago Activo'
                      : '⚠ Sin Access Token Configurado'}
                  </span>

                  <button
                    type="button"
                    onClick={handleVerifyMpConnection}
                    disabled={verifyingMp || (!storeMpAccessToken.trim() && !metrics?.tenantSettings?.hasMpAccessToken)}
                    className="px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {verifyingMp ? 'Verificando...' : 'Probar y Validar Conexión'}
                  </button>
                </div>
              </div>

              {mpVerifyResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    mpVerifyResult.valid
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/40 text-red-200'
                  }`}
                >
                  {mpVerifyResult.valid && mpVerifyResult.account ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-black text-emerald-300">
                          ✓ Cuenta de Mercado Pago Verificada:
                        </span>{' '}
                        {mpVerifyResult.account.firstName} {mpVerifyResult.account.lastName} (
                        <span className="font-mono">{mpVerifyResult.account.nickname}</span> —{' '}
                        {mpVerifyResult.account.email})
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-black/40 font-mono text-[11px]">
                          Seller ID: {mpVerifyResult.account.sellerId}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-black text-[10px] ${
                            mpVerifyResult.account.mode === 'PRODUCTION'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {mpVerifyResult.account.mode}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="font-black text-red-300">✗ Error de validación:</span>{' '}
                      {mpVerifyResult.error}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Access Token de Producción (Obligatorio para cobrar) {metrics?.tenantSettings?.hasMpAccessToken ? '(Configurado ✓ - dejá vacío para mantener)' : ''}
                  </label>
                  <input
                    type="password"
                    value={storeMpAccessToken}
                    onChange={(e) => setStoreMpAccessToken(e.target.value)}
                    placeholder="APP_USR-... (Pegá tu Access Token y tocá Probar Conexión)"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Public Key (APP_USR-...)
                  </label>
                  <input
                    type="text"
                    value={storeMpPublicKey}
                    onChange={(e) => setStoreMpPublicKey(e.target.value)}
                    placeholder="APP_USR-..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Seller ID / Collector ID (Se autocompleta al validar token)
                  </label>
                  <input
                    type="text"
                    value={storeMpSellerId}
                    onChange={(e) => setStoreMpSellerId(e.target.value)}
                    placeholder="Ej: 123456789"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Webhook Secret {metrics?.tenantSettings?.hasMpWebhookSecret ? '(Configurado ✓ - dejá vacío para mantener)' : '(Opcional - Firma HMAC)'}
                  </label>
                  <input
                    type="password"
                    value={storeMpWebhookSecret}
                    onChange={(e) => setStoreMpWebhookSecret(e.target.value)}
                    placeholder="Clave secreta de Webhook (Opcional)"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="bg-gray-950/80 border border-gray-800/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-400">
                <div>
                  <span className="font-bold text-gray-300">URL de Webhook (Notificaciones IPN/Webhooks):</span>{' '}
                  el sistema la adjunta automáticamente en cada orden, o podés configurarla en tu panel de Mercado Pago apuntando a:
                </div>
                <code className="px-2.5 py-1 rounded bg-gray-900 border border-gray-800 text-cyan-300 font-mono text-[11px] select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/mercadopago` : '/api/webhooks/mercadopago'}
                </code>
              </div>
            </div>

            {/* 4. Plan SaaS Activo y Límites Operativos */}
            {metrics?.tenantSettings && (
              <div className="space-y-3 pt-4 border-t border-gray-800">
                <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Plan SaaS contratado y Límites Operativos
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-950/70 border border-gray-800 rounded-2xl p-4">
                  <div>
                    <span className="text-[11px] text-gray-400 uppercase block">Plan Activo</span>
                    <span className="text-sm font-black text-white">
                      {metrics.tenantSettings.planName}
                    </span>
                    <span className="text-[10px] font-mono text-purple-400 block">
                      {metrics.tenantSettings.planCode}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 uppercase block">Comisión Plataforma</span>
                    <span className="text-sm font-black text-emerald-400">
                      {metrics.tenantSettings.feePercentage}% por venta
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      Abono: ${(metrics.tenantSettings.subscriptionPriceMonthly || 0).toLocaleString('es-AR')}/mes
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 uppercase block">Límite Catálogo</span>
                    <span className="text-sm font-black text-white">
                      {metrics.products?.length || 0} / {metrics.tenantSettings.maxProducts}
                    </span>
                    <span className="text-[10px] text-gray-500 block">productos activos/totales</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 uppercase block">Límite Staff</span>
                    <span className="text-sm font-black text-white">
                      Máx. {metrics.tenantSettings.maxStaff} cuentas
                    </span>
                    <span className="text-[10px] text-gray-500 block">Bartenders y Admins</span>
                  </div>
                </div>
              </div>
            )}
          </form>
        )}
      </main>

      {/* MODAL: CREAR NUEVO PRODUCTO */}
      {showCreateProductModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-purple-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 relative">
            <button
              onClick={() => setShowCreateProductModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-white mb-1">Crear Nuevo Producto</h3>
            <p className="text-xs text-gray-400 mb-5">
              Agregá una bebida, botella o combo configurable a la carta de tu tienda.
            </p>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="Ej: Gin Tonic Beefeater 750ml"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Categoría *
                  </label>
                  <input
                    type="text"
                    required
                    list="existing-categories-list"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    placeholder="Ej: Tragos, Botellas, Cervezas..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                  <datalist id="existing-categories-list">
                    {uniqueCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Hora Límite Promo (Opcional)
                  </label>
                  <input
                    type="time"
                    value={newProdDeadline}
                    onChange={(e) => setNewProdDeadline(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Precio ($ ARS) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Stock Disponible *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Descripción / Detalle
                  </label>
                  <textarea
                    rows={2}
                    value={newProdDescription}
                    onChange={(e) => setNewProdDescription(e.target.value)}
                    placeholder="Ej: Vaso grande con hielo en rocas y rodaja de limón..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    URL de Imagen (Opcional)
                  </label>
                  <input
                    type="url"
                    value={newProdImageUrl}
                    onChange={(e) => setNewProdImageUrl(e.target.value)}
                    placeholder="https://.../imagen-trago.jpg"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newProdIsActive}
                  onChange={(e) => setNewProdIsActive(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-950 text-purple-600 focus:ring-purple-500"
                />
                <span>Publicar inmediatamente activo en la carta</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateProductModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingProduct}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {creatingProduct ? 'Creando...' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR PRODUCTO COMPLETO */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-purple-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 relative">
            <button
              onClick={() => setEditingProduct(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1">
              Editar Producto
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Modificá cualquier campo del producto o eliminalo de la carta.
            </p>

            <form onSubmit={handleSaveProductEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Categoría *
                  </label>
                  <input
                    type="text"
                    required
                    list="existing-categories-list"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Hora Límite Promo (Opcional)
                  </label>
                  <input
                    type="time"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Precio de Venta ($ ARS) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Stock Disponible *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editStock}
                    onChange={(e) => setEditStock(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Descripción / Detalle
                  </label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    URL de Imagen (Opcional)
                  </label>
                  <input
                    type="url"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="https://.../imagen.jpg"
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-950 text-purple-600 focus:ring-purple-500"
                />
                <span>Producto activo y visible en la carta</span>
              </label>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setDeletingProduct(editingProduct)}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE PRODUCTO */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white mb-1">
              ¿Eliminar &ldquo;{deletingProduct.name}&rdquo;?
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              Este producto se borrará permanentemente de la base de datos y dejará de aparecer en la carta de inmediato.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deletingProdLoading}
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingProdLoading}
                onClick={handleDeleteProduct}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {deletingProdLoading ? 'Eliminando...' : 'Eliminar Definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR MERMA / ROTURA */}
      {showBreakageModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-rose-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Registrar Rotura o Merma</h3>
                <p className="text-xs text-gray-400">Auditoría contable nocturna</p>
              </div>
            </div>

            <form onSubmit={handleSaveBreakage} className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Producto Afectado *
                </label>
                <select
                  required
                  value={breakageProductId}
                  onChange={(e) => {
                    setBreakageProductId(e.target.value)
                    const p = metrics?.products.find((prod) => prod.id === e.target.value)
                    if (p) {
                      // Costo estimado del 40% del precio de venta
                      setBreakageCost(String(Math.round(p.price * 0.4)))
                    }
                  }}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                >
                  <option value="">-- Seleccionar Bebida --</option>
                  {metrics?.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={breakageQty}
                    onChange={(e) => setBreakageQty(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Costo Estimado ($ ARS)
                  </label>
                  <input
                    type="number"
                    placeholder="Auto o manual"
                    value={breakageCost}
                    onChange={(e) => setBreakageCost(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Motivo *
                </label>
                <select
                  required
                  value={breakageReason}
                  onChange={(e) => setBreakageReason(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500"
                >
                  <option value="BOTELLA_ROTA">Botella Rota en Barra</option>
                  <option value="DERRAME_CLIENTE">Derrame Accidental por Cliente</option>
                  <option value="FALLA_BARTENDER">Falla en Preparación / Descarte</option>
                  <option value="MERMA_VENCIMIENTO">Merma / Pérdida de Frío</option>
                  <option value="OTRO">Otro Motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Se cayó botella al cambiar de turno en barra 2..."
                  value={breakageNotes}
                  onChange={(e) => setBreakageNotes(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowBreakageModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBreakage}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {savingBreakage ? 'Registrando...' : 'Registrar en Auditoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </RoleGuard>
  )
}
