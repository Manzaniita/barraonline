'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getSavedTickets, SavedTicket, generateQrDataUrl, shareTicketNative, triggerDirectDownload } from '@/lib/ticket-generator'
import { QrCode, ArrowLeft, Download, Share2, Sparkles, Clock, CheckCircle2, ShieldCheck, X } from 'lucide-react'

export default function MisTragosPage() {
  const params = useParams()
  const tenantSlug = typeof params?.tenantSlug === 'string' ? params.tenantSlug : 'demo-club'

  const [tickets, setTickets] = useState<SavedTicket[]>([])
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [fullscreenQr, setFullscreenQr] = useState<{ url: string; orderId: string; name: string } | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    async function loadTickets() {
      const saved = getSavedTickets(tenantSlug)
      setTickets(saved)

      // Generar imágenes QR para cada ticket
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
      setIsLoaded(true)
    }

    loadTickets()
  }, [tenantSlug])

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      {/* Cabecera */}
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

          <div className="w-16" />
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-md mx-auto w-full p-4 space-y-4 pb-20">
        {/* Banner Offline */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3.5 text-xs text-purple-200 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
          <p className="leading-snug">
            Tus códigos QR funcionan <strong>100% sin internet</strong>. Presentalos directamente en la barra desde esta pantalla o desde tu galería de fotos.
          </p>
        </div>

        {isLoaded && tickets.length === 0 ? (
          <div className="bg-[#12121a] border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center justify-center my-8 text-white/60">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-purple-400">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-base text-white mb-1">No tenés QRs activos</h3>
            <p className="text-xs text-white/50 max-w-xs mb-6">
              Cuando compres tus tragos en la tienda virtual, acá aparecerán tus códigos para canjear en la barra.
            </p>
            <Link
              href={`/${tenantSlug}`}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-lg shadow-purple-600/25 active:scale-95 transition-all"
            >
              Ir a la Carta de Tragos
            </Link>
          </div>
        ) : (
          tickets.map((ticket) => {
            const qrUrl = qrImages[ticket.orderId]

            return (
              <div
                key={ticket.orderId}
                className="bg-[#12121a] border-2 border-purple-500/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden"
              >
                <div className="flex items-center justify-between text-xs mb-3 pb-2.5 border-b border-white/10">
                  <div>
                    <span className="font-extrabold text-white text-sm block">
                      Orden #{ticket.orderId.slice(0, 8)}
                    </span>
                    <span className="text-[11px] text-white/40">
                      Titular: {ticket.customerName} • DNI {ticket.customerDni}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold px-2 py-0.5 rounded-lg text-[10px]">
                    <Clock className="w-3 h-3" />
                    <span>Hasta las 07:00 AM</span>
                  </div>
                </div>

                {/* QR de Alto Contraste */}
                <div className="text-center my-3">
                  <div
                    onClick={() =>
                      qrUrl &&
                      setFullscreenQr({
                        url: qrUrl,
                        orderId: ticket.orderId,
                        name: ticket.customerName,
                      })
                    }
                    className="bg-white p-3.5 rounded-2xl inline-block shadow-xl cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {qrUrl ? (
                      <img
                        src={qrUrl}
                        alt="Código QR de Canje"
                        className="w-44 h-44 mx-auto object-contain"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-black">
                        <QrCode className="w-12 h-12 animate-spin" />
                      </div>
                    )}
                    <span className="text-[10px] text-black/60 font-mono font-bold block pt-1">
                      TOCÁ PARA EXPANDIR
                    </span>
                  </div>
                </div>

                {/* Detalle de Bebidas Disponibles */}
                <div className="bg-black/30 rounded-2xl p-3 border border-white/5 space-y-1.5 my-3">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Saldo disponible en este QR:
                  </p>
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-white">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="text-purple-400 font-bold">
                        ${(item.unitPrice * item.quantity).toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Acciones del Ticket */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => {
                      if (ticket.ticketDataUrl) {
                        shareTicketNative(
                          ticket.ticketDataUrl,
                          'Ticket QR Barra',
                          `Mi ticket para la barra en ${ticket.nightclubName}`
                        )
                      }
                    }}
                    className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Compartir</span>
                  </button>

                  <button
                    onClick={() => {
                      if (ticket.ticketDataUrl) {
                        triggerDirectDownload(
                          ticket.ticketDataUrl,
                          `ticket-${ticket.orderId.slice(0, 8)}.png`
                        )
                      }
                    }}
                    className="bg-white/10 hover:bg-white/15 text-white font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Bajar PNG</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </main>

      {/* Modal Pantalla Completa para Escaneo en Barra */}
      {fullscreenQr && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
          <button
            onClick={() => setFullscreenQr(null)}
            className="absolute top-6 right-6 p-3 bg-white/20 text-white rounded-full hover:bg-white/30"
          >
            <X className="w-6 h-6" />
          </button>

          <p className="text-xs text-white/60 mb-4 tracking-wider uppercase font-bold">
            Presentar en Barra con Brillo al Máximo
          </p>

          <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-xs w-full aspect-square flex items-center justify-center">
            <img src={fullscreenQr.url} alt="QR Gigante" className="w-full h-full object-contain" />
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
