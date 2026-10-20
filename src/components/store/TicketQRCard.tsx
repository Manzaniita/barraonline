'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  renderTicketToCanvas,
  triggerDirectDownload,
  shareTicketNative,
  saveTicketLocally,
  TicketData,
  generateQrDataUrl,
} from '@/lib/ticket-generator'
import { getSavedCustomerProfile } from '@/lib/customer-session'
import {
  Download,
  Share2,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  QrCode,
  X,
  Clock,
} from 'lucide-react'

interface TicketQRCardProps {
  orderId: string
  tenantSlug: string
  nightclubName: string
  demo?: boolean
  initialQrToken?: string
}

export function TicketQRCard({
  orderId,
  tenantSlug,
  nightclubName,
  demo = false,
  initialQrToken,
}: TicketQRCardProps) {
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null)
  const [qrOnlyUrl, setQrOnlyUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [downloadTriggered, setDownloadTriggered] = useState(false)
  const autoDownloadedRef = useRef(false)

  useEffect(() => {
    async function loadAndGenerateTicket() {
      setIsGenerating(true)
      setOrderError(null)
      try {
        const customer = getSavedCustomerProfile()

        // Obtener la orden real y su token criptográfico firmado desde el endpoint seguro
        const queryParams = new URLSearchParams()
        if (demo) queryParams.set('demo', 'true')
        if (initialQrToken) queryParams.set('token', initialQrToken)
        const qs = queryParams.toString()
        const fetchUrl = `/api/customer/orders/${orderId}${qs ? `?${qs}` : ''}`
        const response = await fetch(fetchUrl, { credentials: 'same-origin' })
        if (!response.ok) {
          setOrderError('La orden no existe o fue eliminada de la base de datos.')
          setIsGenerating(false)
          return
        }

        const data = await response.json()
        const qrToken = data.qrToken || ''
        const dbOrder = data.order

        if (!dbOrder || !dbOrder.items || dbOrder.items.length === 0) {
          setOrderError('No se encontraron productos válidos en esta orden.')
          setIsGenerating(false)
          return
        }

        const ticket: TicketData = {
          orderId,
          tenantSlug,
          nightclubName: dbOrder?.tenant?.name || nightclubName,
          customerName: dbOrder?.user?.fullName || customer?.fullName || 'Cliente',
          customerDni: dbOrder?.user?.dni || customer?.dni || '',
          totalAmount: Number(dbOrder.totalAmount),
          expiresAt: dbOrder.expiresAt
            ? new Date(dbOrder.expiresAt).toISOString()
            : new Date(Date.now() + 1000 * 60 * 60 * 10).toISOString(),
          items: dbOrder.items.map(
            (i: {
              productNameSnapshot?: string
              product?: { name: string }
              quantityPurchased: number
              unitPrice: number
            }) => ({
              name: i.productNameSnapshot || i.product?.name || 'Bebida',
              quantity: i.quantityPurchased,
              unitPrice: Number(i.unitPrice),
            })
          ),
          qrToken: qrToken || orderId,
        }

        setTicketData(ticket)

        // 1. Generar QR directo
        const qrUrl = await generateQrDataUrl(qrToken)
        setQrOnlyUrl(qrUrl)

        // 2. Renderizar ticket completo en Canvas
        const fullTicketUrl = await renderTicketToCanvas(ticket)
        setTicketImageUrl(fullTicketUrl)

        // 3. Guardar en localStorage para acceso offline
        saveTicketLocally(tenantSlug, {
          ...ticket,
          createdAt: new Date().toISOString(),
          status: 'ACTIVE',
          ticketDataUrl: fullTicketUrl,
        })

        // 4. Intentar auto-descarga (una sola vez)
        if (!autoDownloadedRef.current) {
          autoDownloadedRef.current = true
          setTimeout(() => {
            triggerDirectDownload(fullTicketUrl, `ticket-${tenantSlug}-${orderId.slice(0, 8)}.png`)
            setDownloadTriggered(true)
          }, 800)
        }
      } catch (err) {
        console.error('Error generando ticket:', err)
      } finally {
        setIsGenerating(false)
      }
    }

    loadAndGenerateTicket()
  }, [orderId, tenantSlug, nightclubName, demo])

  const handleDownload = () => {
    if (!ticketImageUrl) return
    triggerDirectDownload(ticketImageUrl, `ticket-${tenantSlug}-${orderId.slice(0, 8)}.png`)
    setDownloadTriggered(true)
  }

  const handleShare = async () => {
    if (!ticketImageUrl) return
    const shared = await shareTicketNative(
      ticketImageUrl,
      `Ticket Barra - ${nightclubName}`,
      `Mi ticket de consumición para la barra en ${nightclubName}`
    )
    if (!shared) {
      handleDownload()
    }
  }

  if (isGenerating) {
    return (
      <div className="w-full bg-obsidian-elevated border border-obsidian-border rounded-3xl p-8 text-center flex flex-col items-center justify-center space-y-4 animate-pulse">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
          <Sparkles className="w-8 h-8 animate-spin" />
        </div>
        <p className="font-bold text-sm text-white">Generando Ticket QR de Alta Resolución...</p>
        <p className="text-xs text-white/50">Firmando criptográficamente para retiro en barra sin conexión.</p>
      </div>
    )
  }

  if (orderError || !ticketData) {
    return (
      <div className="w-full bg-red-950/30 border border-red-500/30 rounded-3xl p-6 text-center space-y-2">
        <p className="font-bold text-sm text-red-200">{orderError || 'Orden no disponible.'}</p>
        <p className="text-xs text-red-300/70">Verificá que la orden sea válida o contactá al personal de la barra.</p>
      </div>
    )
  }

  const formattedExpiryHour = ticketData.expiresAt
    ? new Date(ticketData.expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '07:00'

  return (
    <div className="w-full space-y-4">
      {/* Banner Instructivo Obligatorio */}
      <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 text-left flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-xs text-amber-200">
            ¡Guardá tu QR en fotos antes de ir a la barra!
          </h4>
          <p className="text-[11px] text-amber-300/80 leading-relaxed mt-0.5">
            Adentro del boliche suele cortarse la señal de internet. Con la foto guardada en tu galería vas a poder canjear tus bebidas sin ninguna demora.
          </p>
        </div>
      </div>

      {/* Card Visual del Ticket */}
      <div className="bg-obsidian-elevated border-2 border-purple-500/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500" />

        <div className="flex items-center justify-between text-xs text-white/60 mb-3">
          <span className="font-extrabold uppercase tracking-wider text-purple-400">
            {ticketData.nightclubName || nightclubName}
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-amber-400" />
            Hasta las {formattedExpiryHour} hs
          </span>
        </div>

        {/* Contenedor QR de Alto Contraste */}
        <div className="bg-white p-3.5 rounded-2xl inline-block shadow-xl my-2 relative group cursor-pointer" onClick={() => setIsFullScreen(true)}>
          {qrOnlyUrl ? (
            <img
              src={qrOnlyUrl}
              alt="Código QR de Canje"
              style={{ imageRendering: 'pixelated' }}
              className="w-60 h-60 mx-auto object-contain"
            />
          ) : (
            <div className="w-60 h-60 flex items-center justify-center text-black">
              <QrCode className="w-16 h-16 animate-spin" />
            </div>
          )}
          <div className="text-[10px] text-black/70 font-mono font-extrabold pt-1">
            TOCÁ PARA PANTALLA COMPLETA
          </div>
        </div>

        {/* Detalle de Bebidas en este QR */}
        {ticketData && (
          <div className="mt-3 pt-3 border-t border-white/10 text-left">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
              Saldo Disponible en este QR:
            </p>
            <div className="space-y-1">
              {ticketData.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="font-semibold text-white">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="text-purple-400 font-bold">
                    ${(item.unitPrice * item.quantity).toLocaleString('es-AR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>QR Ultrarrápido V2 • Firma HMAC-SHA256 • Canje parcial</span>
        </div>
      </div>

      {/* Botones de Acción: Guardar en Fotos / Compartir */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={handleShare}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 active:scale-95 transition-all"
        >
          <Share2 className="w-4 h-4" />
          <span>Guardar en Fotos</span>
        </button>

        <button
          onClick={handleDownload}
          className="bg-white/10 hover:bg-white/15 text-white font-semibold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-2 border border-white/10 active:scale-95 transition-all"
        >
          <Download className="w-4 h-4 text-purple-400" />
          <span>{downloadTriggered ? 'Descargado ✓' : 'Descargar PNG'}</span>
        </button>
      </div>

      {/* Modal Pantalla Completa para Bartenders */}
      {isFullScreen && qrOnlyUrl && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
          <button
            onClick={() => setIsFullScreen(false)}
            className="absolute top-6 right-6 p-3 bg-white/20 text-white rounded-full hover:bg-white/30"
          >
            <X className="w-6 h-6" />
          </button>

          <p className="text-xs text-white/60 mb-4 tracking-wider uppercase font-bold">
            Presentar en Barra con Brillo Máximo
          </p>

          <div className="bg-white p-5 rounded-3xl shadow-2xl max-w-xs w-full aspect-square flex items-center justify-center">
            <img
              src={qrOnlyUrl}
              alt="QR Gigante"
              style={{ imageRendering: 'pixelated' }}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="mt-6 text-center text-white">
            <p className="font-extrabold text-base">{ticketData?.customerName}</p>
            <p className="text-xs text-white/50">DNI: {ticketData?.customerDni}</p>
          </div>
        </div>
      )}
    </div>
  )
}
