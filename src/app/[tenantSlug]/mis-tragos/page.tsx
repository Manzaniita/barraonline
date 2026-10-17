'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  getSavedTickets,
  SavedTicket,
  generateQrDataUrl,
  shareTicketNative,
  triggerDirectDownload,
  saveTicketLocally,
} from '@/lib/ticket-generator'
import { getSavedCustomerProfile } from '@/lib/customer-session'
import {
  QrCode,
  ArrowLeft,
  Download,
  Share2,
  Sparkles,
  Clock,
  CheckCircle2,
  ShieldCheck,
  X,
  History,
  AlertTriangle,
  Wine,
  Check,
  Receipt,
  RotateCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
} from 'lucide-react'

interface OrderItemLive {
  orderItemId: string
  productId: string
  name: string
  quantityPurchased: number
  quantityRedeemed: number
  quantityAvailable: number
  unitPrice: number
  isFullyRedeemed: boolean
  isPartiallyRedeemed: boolean
}

interface RedemptionEvent {
  id: string
  productName: string
  quantity: number
  bartenderName: string
  redeemedAt: string
}

interface LiveOrder {
  orderId: string
  tenantSlug: string
  nightclubName: string
  customerName: string
  customerDni: string
  totalAmount: number
  status: string
  createdAt: string
  expiresAt: string
  isExpired: boolean
  isFullyRedeemed: boolean
  isPartiallyRedeemed: boolean
  totalPurchased: number
  totalRedeemed: number
  totalAvailable: number
  items: OrderItemLive[]
  redemptions: RedemptionEvent[]
  unredeemedItems: { name: string; quantity: number; reason: string }[]
  qrToken?: string
  ticketDataUrl?: string
}

export default function MisTragosPage() {
  const params = useParams()
  const tenantSlug = typeof params?.tenantSlug === 'string' ? params.tenantSlug : 'demo-club'

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [activeOrders, setActiveOrders] = useState<LiveOrder[]>([])
  const [historyOrders, setHistoryOrders] = useState<LiveOrder[]>([])
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [fullscreenQr, setFullscreenQr] = useState<{ url: string; orderId: string; name: string } | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [liveBanner, setLiveBanner] = useState<string | null>(null)

  // Guardamos las redenciones previas para detectar canjes en vivo mientras el usuario mira la pantalla
  const prevRedeemedCountRef = useRef<Record<string, number>>({})

  // 1. Cargar tickets iniciales desde almacenamiento local offline
  useEffect(() => {
    async function loadInitialData() {
      const saved = getSavedTickets(tenantSlug)
      const now = new Date()

      // Convertir SavedTickets en el formato inicial
      const initialActive: LiveOrder[] = []
      const initialHistory: LiveOrder[] = []

      for (const t of saved) {
        const isExp = now > new Date(t.expiresAt)
        const totalPurchased = t.items.reduce((acc, it) => acc + it.quantity, 0)
        const totalRedeemed = t.items.reduce((acc, it) => acc + (it.quantityRedeemed || 0), 0)
        const isFull = totalRedeemed >= totalPurchased && totalPurchased > 0
        const isPartial = totalRedeemed > 0 && totalRedeemed < totalPurchased

        const formatted: LiveOrder = {
          orderId: t.orderId,
          tenantSlug: t.tenantSlug,
          nightclubName: t.nightclubName,
          customerName: t.customerName,
          customerDni: t.customerDni,
          totalAmount: t.totalAmount,
          status: isFull ? 'DEPLETED' : isExp ? 'EXPIRED' : 'ACTIVE',
          createdAt: t.createdAt,
          expiresAt: t.expiresAt,
          isExpired: isExp,
          isFullyRedeemed: isFull,
          isPartiallyRedeemed: isPartial,
          totalPurchased,
          totalRedeemed,
          totalAvailable: Math.max(0, totalPurchased - totalRedeemed),
          items: t.items.map((it, idx) => ({
            orderItemId: `item-${idx}`,
            productId: `prod-${idx}`,
            name: it.name,
            quantityPurchased: it.quantity,
            quantityRedeemed: it.quantityRedeemed || 0,
            quantityAvailable: Math.max(0, it.quantity - (it.quantityRedeemed || 0)),
            unitPrice: it.unitPrice,
            isFullyRedeemed: (it.quantityRedeemed || 0) >= it.quantity,
            isPartiallyRedeemed: (it.quantityRedeemed || 0) > 0 && (it.quantityRedeemed || 0) < it.quantity,
          })),
          redemptions: [],
          unredeemedItems: isExp && !isFull ? [{ name: 'Tragos de la orden', quantity: totalPurchased - totalRedeemed, reason: 'Vencido al cierre' }] : [],
          qrToken: t.qrToken,
          ticketDataUrl: t.ticketDataUrl,
        }

        if (!isExp && !isFull) {
          initialActive.push(formatted)
        } else {
          initialHistory.push(formatted)
        }
      }

      setActiveOrders(initialActive)
      setHistoryOrders(initialHistory)
      setIsLoaded(true)

      // Generar QRs para cada ticket activo
      const map: Record<string, string> = {}
      for (const t of saved) {
        if (t.qrToken) {
          try {
            map[t.orderId] = await generateQrDataUrl(t.qrToken)
          } catch (e) {
            console.error('Error generando QR para ticket:', e)
          }
        }
      }
      setQrImages(map)
    }

    loadInitialData()
  }, [tenantSlug])

  // 2. Consulta en vivo al backend para detectar canjes parciales, totales y vencimientos
  const syncLiveStatus = useCallback(async () => {
    try {
      const saved = getSavedTickets(tenantSlug)
      const orderIds = saved.map((t) => t.orderId)
      const customer = getSavedCustomerProfile()

      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          orderIds,
          userDni: customer?.dni,
        }),
      })

      const data = await res.json()
      if (data.success) {
        const liveActive: LiveOrder[] = data.activeOrders || []
        const liveHistory: LiveOrder[] = data.historyOrders || []

        // Mapear qrToken y ticketDataUrl guardados localmente
        const enrichedActive = liveActive.map((ord) => {
          const localMatch = saved.find((s) => s.orderId === ord.orderId)
          return {
            ...ord,
            qrToken: localMatch?.qrToken || ord.orderId,
            ticketDataUrl: localMatch?.ticketDataUrl,
          }
        })

        const enrichedHistory = liveHistory.map((ord) => {
          const localMatch = saved.find((s) => s.orderId === ord.orderId)
          return {
            ...ord,
            qrToken: localMatch?.qrToken || ord.orderId,
            ticketDataUrl: localMatch?.ticketDataUrl,
          }
        })

        // Detectar si hubo canjes nuevos en vivo para notificar al usuario
        for (const ord of [...enrichedActive, ...enrichedHistory]) {
          const prevCount = prevRedeemedCountRef.current[ord.orderId]
          if (prevCount !== undefined && ord.totalRedeemed > prevCount) {
            const diff = ord.totalRedeemed - prevCount
            setLiveBanner(
              ord.isFullyRedeemed
                ? `🎉 ¡Canje Completo! Se entregaron todos los tragos de tu orden #${ord.orderId.slice(0, 8)}.`
                : `⚡ ¡Canje Parcial! El bartender entregó ${diff} ${diff === 1 ? 'bebida' : 'bebidas'} en barra.`
            )
            setTimeout(() => setLiveBanner(null), 5000)
          }
          prevRedeemedCountRef.current[ord.orderId] = ord.totalRedeemed
        }

        // Generar QRs faltantes si llegaron órdenes nuevas
        for (const ord of enrichedActive) {
          if (!qrImages[ord.orderId] && ord.qrToken) {
            try {
              const url = await generateQrDataUrl(ord.qrToken)
              setQrImages((prev) => ({ ...prev, [ord.orderId]: url }))
            } catch {}
          }
        }

        setActiveOrders(enrichedActive)
        setHistoryOrders(enrichedHistory)
      }
    } catch (err) {
      console.warn('Error sincronizando estado en vivo:', err)
    }
  }, [tenantSlug, qrImages])

  // 3. Polling en vivo cada 3.5 segundos mientras la pestaña esté visible
  useEffect(() => {
    syncLiveStatus()

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncLiveStatus()
      }
    }, 3500)

    return () => clearInterval(interval)
  }, [syncLiveStatus])

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      {/* Cabecera Móvil */}
      <header className="sticky top-0 z-30 bg-[#0e0e14]/90 backdrop-blur-md border-b border-white/10 px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href={`/${tenantSlug}`}
            className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white py-1 px-2.5 rounded-xl bg-white/5 border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a la Carta</span>
          </Link>

          <h1 className="font-extrabold text-sm text-white flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-purple-400" />
            <span>Mis Tragos y QRs</span>
          </h1>

          <button
            onClick={() => {
              setIsSyncing(true)
              syncLiveStatus().finally(() => setIsSyncing(false))
            }}
            className="p-1.5 text-white/50 hover:text-white rounded-lg bg-white/5 border border-white/10"
            title="Actualizar en vivo"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Banner flotante de Canje en Vivo */}
      {liveBanner && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-900/95 via-fuchsia-900/95 to-pink-900/95 border border-purple-400/50 text-white text-xs font-bold shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
            <span>{liveBanner}</span>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="flex-1 max-w-md mx-auto w-full p-4 space-y-4 pb-20">
        {/* Banner Offline */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3.5 text-xs text-purple-200 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
          <p className="leading-snug">
            Tus códigos QR funcionan <strong>100% sin internet</strong>. Presentalos directamente en la barra desde esta pantalla o desde tu galería de fotos.
          </p>
        </div>

        {/* Selector de Pestañas: QRs Activos vs Historial de Compras */}
        <div className="grid grid-cols-2 p-1 bg-white/[0.04] rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/40'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QRs Activos ({activeOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/40'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial ({historyOrders.length})</span>
          </button>
        </div>

        {/* ---------------- PESTAÑA 1: QRS ACTIVOS DISPONIBLES ---------------- */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {isLoaded && activeOrders.length === 0 ? (
              <div className="bg-[#12121a] border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center justify-center my-6 text-white/60">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-purple-400">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-white mb-1">No tenés QRs activos pendientes</h3>
                <p className="text-xs text-white/50 max-w-xs mb-6">
                  Tus compras anteriores ya fueron canjeadas o vencieron y están guardadas en la pestaña de <strong>Historial</strong>.
                </p>
                <Link
                  href={`/${tenantSlug}`}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-lg shadow-purple-600/25 active:scale-95 transition-all"
                >
                  Ir a la Carta de Tragos
                </Link>
              </div>
            ) : (
              activeOrders.map((order) => {
                const qrUrl = qrImages[order.orderId]

                return (
                  <div
                    key={order.orderId}
                    className={`bg-[#12121a] rounded-3xl p-5 shadow-2xl relative overflow-hidden transition-all border-2 ${
                      order.isPartiallyRedeemed
                        ? 'border-amber-500/50 shadow-amber-950/20'
                        : 'border-purple-500/30'
                    }`}
                  >
                    {/* Header del Ticket */}
                    <div className="flex items-center justify-between text-xs mb-3 pb-2.5 border-b border-white/10">
                      <div>
                        <span className="font-extrabold text-white text-sm block">
                          Orden #{order.orderId.slice(0, 8)}
                        </span>
                        <span className="text-[11px] text-white/40">
                          Titular: {order.customerName} {order.customerDni ? `• DNI ${order.customerDni}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold px-2 py-0.5 rounded-lg text-[10px]">
                        <Clock className="w-3 h-3" />
                        <span>Hasta las 07:00 AM</span>
                      </div>
                    </div>

                    {/* Badge de Estado en Vivo (Total o Parcial) */}
                    <div className="mb-3">
                      {order.isPartiallyRedeemed ? (
                        <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                            <span className="font-bold">Canje Parcial en Curso</span>
                          </div>
                          <span className="font-extrabold bg-amber-500/20 px-2 py-0.5 rounded-full text-[11px]">
                            {order.totalRedeemed} de {order.totalPurchased} entregados
                          </span>
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>Listo para canjear en barra</span>
                          </div>
                          <span className="text-[11px] text-emerald-400/80 font-semibold">
                            {order.totalPurchased} {order.totalPurchased === 1 ? 'trago' : 'tragos'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* QR de Alto Contraste */}
                    <div className="text-center my-3">
                      <div
                        onClick={() =>
                          qrUrl &&
                          setFullscreenQr({
                            url: qrUrl,
                            orderId: order.orderId,
                            name: order.customerName,
                          })
                        }
                        className="bg-white p-4 rounded-3xl inline-block shadow-2xl cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        {qrUrl ? (
                          <img
                            src={qrUrl}
                            alt="Código QR de Canje"
                            style={{ imageRendering: 'pixelated' }}
                            className="w-56 h-56 mx-auto object-contain"
                          />
                        ) : (
                          <div className="w-56 h-56 flex items-center justify-center text-black">
                            <QrCode className="w-12 h-12 animate-spin" />
                          </div>
                        )}
                        <span className="text-[10px] text-black/70 font-mono font-extrabold block pt-2">
                          TOCÁ PARA PANTALLA COMPLETA
                        </span>
                      </div>
                    </div>

                    {/* Saldo Disponible para Retirar en Barra */}
                    <div className="bg-black/40 rounded-2xl p-3.5 border border-white/5 space-y-2 my-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                          <Wine className="w-3.5 h-3.5" />
                          <span>Saldo disponible en este QR:</span>
                        </span>
                        <span className="font-bold text-white">
                          {order.totalAvailable} {order.totalAvailable === 1 ? 'pendiente' : 'pendientes'}
                        </span>
                      </div>

                      {order.items
                        .filter((item) => item.quantityAvailable > 0)
                        .map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs pt-1 border-t border-white/5">
                            <span className="font-bold text-white">
                              {item.quantityAvailable}x {item.name}
                            </span>
                            <span className="text-emerald-400 font-bold font-mono">
                              ${(item.unitPrice * item.quantityAvailable).toLocaleString('es-AR')}
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Sección de Canjes ya Entregados (si tiene canje parcial) */}
                    {order.isPartiallyRedeemed && order.redemptions.length > 0 && (
                      <div className="bg-emerald-950/20 rounded-2xl p-3 border border-emerald-500/20 space-y-1.5 my-3 text-xs">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                          Ya entregado en barra ({order.totalRedeemed} tragos):
                        </span>
                        {order.redemptions.map((red, idx) => (
                          <div key={idx} className="flex items-center justify-between text-emerald-200/90 text-[11px]">
                            <span>
                              ✓ {red.quantity}x {red.productName}
                            </span>
                            <span className="text-emerald-400/60 font-mono text-[10px]">
                              {new Date(red.redeemedAt).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Acciones del Ticket */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => {
                          if (order.ticketDataUrl) {
                            shareTicketNative(
                              order.ticketDataUrl,
                              'Ticket QR Barra',
                              `Mi ticket para la barra en ${order.nightclubName}`
                            )
                          }
                        }}
                        className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Compartir</span>
                      </button>

                      <button
                        onClick={() => {
                          if (order.ticketDataUrl) {
                            triggerDirectDownload(
                              order.ticketDataUrl,
                              `ticket-${order.orderId.slice(0, 8)}.png`
                            )
                          }
                        }}
                        className="bg-white/10 hover:bg-white/15 text-white font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Bajar PNG</span>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ---------------- PESTAÑA 2: HISTORIAL DE COMPRAS ("QUÉ PASÓ") ---------------- */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {historyOrders.length === 0 ? (
              <div className="bg-[#12121a] border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center justify-center my-6 text-white/60">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-purple-400">
                  <Receipt className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-white mb-1">Sin compras en el historial</h3>
                <p className="text-xs text-white/50 max-w-xs">
                  Cuando canjees todos los tragos de tus pedidos o cuando los QRs expiren al corte de las 07:00 AM, quedarán archivados acá con el reporte completo de entrega.
                </p>
              </div>
            ) : (
              historyOrders.map((order) => {
                return (
                  <div
                    key={order.orderId}
                    className="bg-[#121218] border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden"
                  >
                    {/* Header con Estado Final */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/10 text-xs">
                      <div>
                        <span className="font-black text-white text-sm block">
                          Orden #{order.orderId.slice(0, 8)}
                        </span>
                        <span className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(order.createdAt).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </span>
                      </div>

                      <div>
                        {order.isFullyRedeemed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Canjeado Completo</span>
                          </span>
                        ) : order.isPartiallyRedeemed && order.isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px] uppercase tracking-wider">
                            <AlertCircle className="w-3 h-3" />
                            <span>Vencido (Canje Parcial)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[10px] uppercase tracking-wider">
                            <Clock className="w-3 h-3" />
                            <span>Vencido al Cierre</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Importe Total Pagado */}
                    <div className="py-2.5 flex items-center justify-between text-xs border-b border-white/5">
                      <span className="text-white/60">Total abonado por Mercado Pago:</span>
                      <span className="font-extrabold text-sm text-white font-mono">
                        ${order.totalAmount.toLocaleString('es-AR')}
                      </span>
                    </div>

                    {/* SECCIÓN "¿QUÉ PASÓ CON CADA COMPRA?" */}
                    <div className="my-3 space-y-2">
                      <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                        <History className="w-3 h-3" />
                        <span>¿Qué pasó con tus bebidas?</span>
                      </p>

                      {/* Entregas exitosas registradas */}
                      {order.redemptions.length > 0 && (
                        <div className="space-y-1.5">
                          {order.redemptions.map((red, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 flex items-start justify-between gap-2"
                            >
                              <div>
                                <p className="font-bold leading-tight">
                                  ✓ {red.quantity}x {red.productName}
                                </p>
                                <p className="text-[10px] text-emerald-400/70 mt-0.5">
                                  Despachado por {red.bartenderName}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                                {new Date(red.redeemedAt).toLocaleTimeString('es-AR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tragos no retirados que expiraron */}
                      {order.unredeemedItems.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {order.unredeemedItems.map((unred, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 flex items-start justify-between gap-2"
                            >
                              <div>
                                <p className="font-bold leading-tight">
                                  ✗ {unred.quantity}x {unred.name}
                                </p>
                                <p className="text-[10px] text-rose-300/70 mt-0.5">
                                  {unred.reason}
                                </p>
                              </div>
                              <span className="text-[10px] font-mono text-rose-400 shrink-0 uppercase">
                                Expirado
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Resumen de ítems si no hubo redenciones individuales */}
                      {order.redemptions.length === 0 && order.unredeemedItems.length === 0 && (
                        <div className="space-y-1 text-xs text-white/70">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1">
                              <span>
                                {it.quantityPurchased}x {it.name}
                              </span>
                              <span className="text-white/40">
                                {order.isFullyRedeemed ? 'Entregado en barra' : 'Expirado'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* QR Inactivo / Finalizado */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                      <span>Este código QR ya no es válido para canje</span>
                      {order.ticketDataUrl && (
                        <button
                          onClick={() => {
                            if (order.ticketDataUrl) {
                              triggerDirectDownload(
                                order.ticketDataUrl,
                                `comprobante-${order.orderId.slice(0, 8)}.png`
                              )
                            }
                          }}
                          className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Descargar Comprobante</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </main>

      {/* Modal Pantalla Completa para Escaneo en Barra */}
      {fullscreenQr && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
          <button
            onClick={() => setFullscreenQr(null)}
            className="absolute top-6 right-6 p-3 bg-white/20 text-white rounded-full hover:bg-white/30 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <p className="text-xs text-white/60 mb-4 tracking-wider uppercase font-bold">
            Presentar en Barra con Brillo al Máximo
          </p>

          <div className="bg-white p-5 rounded-3xl shadow-2xl max-w-xs w-full aspect-square flex items-center justify-center">
            <img
              src={fullscreenQr.url}
              alt="QR Gigante"
              style={{ imageRendering: 'pixelated' }}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="mt-6 text-center text-white">
            <p className="font-extrabold text-base">{fullscreenQr.name}</p>
            <p className="text-xs text-white/50">Orden #{fullscreenQr.orderId.slice(0, 8)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
