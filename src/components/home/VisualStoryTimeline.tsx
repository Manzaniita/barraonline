'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Plus,
  Minus,
  Clock,
  CreditCard,
  QrCode,
  ArrowUpRight,
  Download,
  IdCard,
  WifiOff,
  Wine,
} from 'lucide-react'
import { HomeClubItem } from './types'

interface VisualStoryTimelineProps {
  primaryClub: HomeClubItem | null
  onFocusSearch: () => void
}

export function VisualStoryTimeline({ primaryClub, onFocusSearch }: VisualStoryTimelineProps) {
  const [activeStage, setActiveStage] = useState<number>(0)

  const sampleClubName = primaryClub?.displayName || 'Club Nocturno'
  const sampleClubSlug = primaryClub?.slug || 'club'
  const sampleExpiry = primaryClub?.defaultExpirationHour || '07:00'

  const stages = [
    {
      num: '01',
      label: 'ENCONTRÁ TU LUGAR',
      kicker: 'Acceso directo desde tu mesa o la pista',
      title: 'Buscás el boliche donde estás y abrís su carta oficial.',
      description:
        'Sin descargar aplicaciones pesadas ni hacer fila para preguntar qué hay. Entrás al perfil del local en BarraOnline y ves su barra activa al instante.',
      meta: 'Sin descargas • Acceso inmediato desde el navegador',
    },
    {
      num: '02',
      label: 'ELEGÍ TU TRAGO',
      kicker: 'Precios claros antes de acercarte a la barra',
      title: 'Explorás tragos, cervezas y combos con stock en tiempo real.',
      description:
        'Recorrés las categorías a tu ritmo, consultás qué promociones tienen horario límite y sumás lo que quieras tomar con tus amigos sin gritar por encima de la música.',
      meta: 'Precios transparentes • Promos y disponibilidad al día',
    },
    {
      num: '03',
      label: 'PEDÍ Y PAGÁ',
      kicker: 'Compra respaldada con tu documento',
      title: 'Confirmás tu pedido y abonás con Mercado Pago desde el celular.',
      description:
        'Ingresás tu DNI una sola vez para que tus bebidas queden vinculadas a tu nombre y completás el pago con tu cuenta o tarjeta en segundos.',
      meta: 'Pago online por Mercado Pago • Respaldo por DNI',
    },
    {
      num: '04',
      label: 'RETIRÁ Y SEGUÍ',
      kicker: 'Con o sin señal, de a uno o todos juntos',
      title: 'Mostrás tu QR en la barra, retirás tus bebidas y seguís la noche.',
      description:
        'Tu ticket QR se descarga automáticamente en la galería de Fotos para que funcione aunque adentro no tengas señal. Y si compraste varios tragos, podés retirarlos de a uno durante toda la noche.',
      meta: `Canje parcial habilitado • Válido hasta las ${sampleExpiry} hs`,
    },
  ]

  return (
    <section
      id="como-funciona"
      aria-labelledby="story-heading"
      className="relative py-20 sm:py-28 border-t border-[#F6F3EC]/10 bg-[#070708] overflow-hidden"
    >
      {/* Subtle architectural grid lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #F6F3EC 1px, transparent 1px), linear-gradient(to bottom, #F6F3EC 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabecera Editorial de la Sección */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-14 sm:mb-20">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF7A33] font-mono-tech text-[11px] uppercase tracking-[0.18em] mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
              <span>Secuencia de la noche • 01 a 04</span>
            </div>
            <h2
              id="story-heading"
              className="font-display-syne text-3xl sm:text-5xl lg:text-[3.35rem] font-extrabold tracking-tight text-[#F6F3EC] leading-[1.03]"
            >
              Cuatro momentos entre tu celular y{' '}
              <span className="font-serif-editorial italic font-normal text-[#D4FF00]">
                tu próximo vaso en mano.
              </span>
            </h2>
          </div>

          <div className="lg:col-span-5 lg:pl-6 border-l border-[#F6F3EC]/15">
            <p className="text-sm sm:text-base text-[#B6AFA3] leading-relaxed">
              Cada pantalla de BarraOnline está pensada para la oscuridad, el movimiento y la poca señal de una noche real. Tocá cada etapa para ver qué vas a encontrar en tu pantalla.
            </p>
          </div>
        </div>

        {/* Selector de Etapas + Escenario Visual Asimétrico */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Columna Izquierda: Los 4 Momentos Narrativos */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-3">
            {stages.map((stage, index) => {
              const isSelected = activeStage === index
              return (
                <button
                  key={stage.num}
                  type="button"
                  onClick={() => setActiveStage(index)}
                  className={`group w-full text-left rounded-2xl p-5 sm:p-6 transition-all duration-300 border cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-[#141311] border-[#D4FF00]/50 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85)]'
                      : 'bg-[#0C0B0A]/70 border-[#F6F3EC]/8 hover:border-[#F6F3EC]/20 hover:bg-[#11100E]'
                  }`}
                >
                  {/* Barra lateral activa */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
                      isSelected ? 'bg-[#D4FF00]' : 'bg-transparent group-hover:bg-[#F6F3EC]/20'
                    }`}
                  />

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono-tech text-xs font-bold px-2.5 py-1 rounded-md border transition-colors ${
                          isSelected
                            ? 'bg-[#D4FF00] text-[#050506] border-[#D4FF00]'
                            : 'bg-[#F6F3EC]/5 text-[#B6AFA3] border-[#F6F3EC]/10'
                        }`}
                      >
                        {stage.num}
                      </span>
                      <span
                        className={`font-mono-tech text-xs font-bold tracking-[0.14em] uppercase ${
                          isSelected ? 'text-[#D4FF00]' : 'text-[#B6AFA3]'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>

                    <span className="font-mono-tech text-[11px] text-[#706B62] hidden sm:inline">
                      {stage.kicker}
                    </span>
                  </div>

                  <h3
                    className={`mt-3 font-bold text-base sm:text-lg leading-snug transition-colors ${
                      isSelected ? 'text-[#F6F3EC]' : 'text-[#F6F3EC]/80 group-hover:text-[#F6F3EC]'
                    }`}
                  >
                    {stage.title}
                  </h3>

                  {isSelected && (
                    <div className="mt-3 space-y-3 animate-in fade-in duration-200">
                      <p className="text-xs sm:text-sm text-[#B6AFA3] leading-relaxed">
                        {stage.description}
                      </p>
                      <div className="pt-2 border-t border-[#F6F3EC]/10 flex items-center justify-between gap-2 text-[11px] font-mono-tech text-[#FF7A33]">
                        <span>{stage.meta}</span>
                        <span className="text-[#D4FF00]">ETAPA {stage.num}/04 →</span>
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Columna Derecha: Representación Fiel de Cada Pantalla Real */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="relative flex-1 rounded-3xl bg-[#100F0D] border border-[#F6F3EC]/12 p-5 sm:p-8 flex flex-col justify-between overflow-hidden min-h-[460px]">
              {/* Iluminación ambiental según la etapa */}
              <div
                className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-500"
                style={{
                  background:
                    activeStage === 0
                      ? 'radial-gradient(circle, rgba(255,85,0,0.22) 0%, transparent 70%)'
                      : activeStage === 1
                      ? 'radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%)'
                      : activeStage === 2
                      ? 'radial-gradient(circle, rgba(56,189,248,0.20) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(212,255,0,0.22) 0%, transparent 70%)',
                }}
              />

              {/* Top Stage Bar */}
              <div className="relative z-10 flex items-center justify-between gap-3 pb-5 border-b border-[#F6F3EC]/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D4FF00]" />
                  <span className="font-mono-tech text-xs uppercase tracking-[0.15em] text-[#F6F3EC]">
                    VISTA EN TU CELULAR • {stages[activeStage].label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setActiveStage(step)}
                      aria-label={`Ver etapa ${step + 1}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        activeStage === step ? 'w-7 bg-[#D4FF00]' : 'w-2 bg-[#F6F3EC]/20'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* ESCENA 01: ENCONTRÁ TU LUGAR */}
              {activeStage === 0 && (
                <div className="relative z-10 my-auto py-6 space-y-4 animate-in fade-in duration-200">
                  <div className="rounded-2xl bg-[#181614] border border-[#F6F3EC]/15 p-4 shadow-xl">
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#090908] border border-[#D4FF00]/40">
                      <Search className="w-4 h-4 text-[#D4FF00] shrink-0" />
                      <span className="text-sm text-[#F6F3EC] font-medium truncate">
                        {sampleClubName}
                      </span>
                      <span className="ml-auto font-mono-tech text-[10px] px-2 py-0.5 rounded bg-[#D4FF00]/15 text-[#D4FF00]">
                        EN VIVO
                      </span>
                    </div>

                    <div className="mt-4 p-4 rounded-xl bg-[#0E0D0C] border border-[#F6F3EC]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-[#F6F3EC] font-display-syne font-extrabold text-lg shrink-0 border border-white/15"
                          style={{
                            backgroundColor: primaryClub?.primaryColor || '#FF5500',
                          }}
                        >
                          {sampleClubName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-base text-[#F6F3EC]">
                              {sampleClubName}
                            </h4>
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          </div>
                          <p className="text-xs text-[#B6AFA3]">
                            {primaryClub?.tagline || 'Barra digital habilitada • Retiro con QR'}
                          </p>
                          <p className="font-mono-tech text-[11px] text-[#FF7A33] mt-1">
                            /{sampleClubSlug} • Cierre de barra {sampleExpiry} hs
                          </p>
                        </div>
                      </div>

                      {primaryClub ? (
                        <Link
                          href={`/${primaryClub.slug}`}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D4FF00] text-[#050506] font-bold text-xs shrink-0 hover:bg-[#e1ff33] transition-colors"
                        >
                          <span>Abrir Carta</span>
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={onFocusSearch}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D4FF00] text-[#050506] font-bold text-xs shrink-0 hover:bg-[#e1ff33] transition-colors cursor-pointer"
                        >
                          <span>Buscar Local</span>
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#151412] border border-[#F6F3EC]/8">
                      <span className="font-mono-tech text-[10px] text-[#706B62] uppercase block">
                        ACCESO EN EL CLUB
                      </span>
                      <span className="text-[#F6F3EC] font-semibold mt-1 block">
                        Por buscador o link directo /{sampleClubSlug}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#151412] border border-[#F6F3EC]/8">
                      <span className="font-mono-tech text-[10px] text-[#706B62] uppercase block">
                        INSTALACIÓN
                      </span>
                      <span className="text-[#D4FF00] font-semibold mt-1 block">
                        0 MB • Directo desde tu navegador
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ESCENA 02: ELEGÍ TU TRAGO */}
              {activeStage === 1 && (
                <div className="relative z-10 my-auto py-5 space-y-3.5 animate-in fade-in duration-200">
                  {/* Category tabs recreation */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {['Todos', 'Tragos', 'Combos', 'Cervezas', 'Sin Alcohol'].map((cat, idx) => (
                      <span
                        key={cat}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                          idx === 1
                            ? 'bg-[#FF5500] text-[#F6F3EC]'
                            : 'bg-[#181614] text-[#B6AFA3] border border-[#F6F3EC]/10'
                        }`}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  {/* Product Card Recreation */}
                  <div className="rounded-2xl bg-[#181614] border border-[#F6F3EC]/15 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF5500]/15 text-[#FF7A33] text-[10px] font-bold">
                            <Wine className="w-3 h-3" />
                            Tragos
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                            <Clock className="w-3 h-3" />
                            Promo hasta 02:30
                          </span>
                        </div>
                        <h4 className="font-bold text-base text-[#F6F3EC]">
                          {primaryClub?.featuredProducts[0]?.name || 'Fernet Branca con Coca-Cola'}
                        </h4>
                        <p className="text-xs text-[#B6AFA3] mt-0.5">
                          {primaryClub?.featuredProducts[0]?.description ||
                            'Vaso de 500ml preparado en el momento con hielo cristalino.'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#F6F3EC]/10 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono-tech text-[#706B62] uppercase block">
                          PRECIO EN CARTA
                        </span>
                        <span className="text-lg font-extrabold text-[#F6F3EC] font-mono-tech">
                          $
                          {(primaryClub?.featuredProducts[0]?.price || 8500).toLocaleString(
                            'es-AR'
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 bg-[#0C0B0A] p-1.5 rounded-xl border border-[#D4FF00]/40">
                        <span className="w-7 h-7 rounded-lg bg-[#F6F3EC]/10 flex items-center justify-center text-[#F6F3EC]">
                          <Minus className="w-3.5 h-3.5" />
                        </span>
                        <span className="font-mono-tech font-bold text-sm text-[#D4FF00] px-1">
                          2
                        </span>
                        <span className="w-7 h-7 rounded-lg bg-[#D4FF00] flex items-center justify-center text-[#050506]">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Floating Cart Bar Recreation */}
                  <div className="rounded-2xl bg-[#D4FF00] text-[#050506] p-3.5 flex items-center justify-between font-bold text-xs shadow-lg">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#050506] text-[#D4FF00] font-mono-tech">
                        2 ítems
                      </span>
                      <span>Ver tu pedido actual</span>
                    </div>
                    <span className="font-mono-tech text-sm font-extrabold">
                      $
                      {((primaryClub?.featuredProducts[0]?.price || 8500) * 2).toLocaleString(
                        'es-AR'
                      )}{' '}
                      →
                    </span>
                  </div>
                </div>
              )}

              {/* ESCENA 03: PEDÍ Y PAGÁ */}
              {activeStage === 2 && (
                <div className="relative z-10 my-auto py-5 space-y-4 animate-in fade-in duration-200">
                  <div className="rounded-2xl bg-[#181614] border border-[#F6F3EC]/15 p-4 space-y-3.5">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F6F3EC]/10">
                      <div>
                        <span className="text-xs font-bold text-[#F6F3EC] block">
                          Identificación del titular
                        </span>
                        <span className="text-[11px] text-[#B6AFA3]">
                          Tu DNI respalda tus tragos si te quedás sin batería
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono-tech font-bold flex items-center gap-1">
                        <IdCard className="w-3.5 h-3.5" />
                        DNI VERIFICADO
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-[#B6AFA3]">
                        <span>2x Trago seleccionado en carta</span>
                        <span className="font-mono-tech text-[#F6F3EC]">
                          $
                          {((primaryClub?.featuredProducts[0]?.price || 8500) * 2).toLocaleString(
                            'es-AR'
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline pt-2 border-t border-[#F6F3EC]/10">
                        <span className="text-[#F6F3EC] font-bold">Total a abonar</span>
                        <span className="text-xl font-extrabold text-[#D4FF00] font-mono-tech">
                          $
                          {((primaryClub?.featuredProducts[0]?.price || 8500) * 2).toLocaleString(
                            'es-AR'
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="w-full py-3.5 px-4 rounded-xl bg-[#009EE3] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg">
                      <CreditCard className="w-4 h-4" />
                      <span>Pagar con Mercado Pago</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#B6AFA3] text-center font-mono-tech">
                    Al aprobarse el pago, volvés automáticamente a tu Ticket QR listo para barra.
                  </p>
                </div>
              )}

              {/* ESCENA 04: RETIRÁ Y SEGUÍ */}
              {activeStage === 3 && (
                <div className="relative z-10 my-auto py-4 space-y-3.5 animate-in fade-in duration-200">
                  <div className="rounded-2xl bg-[#181614] border-2 border-[#D4FF00]/50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-tech font-bold text-[#D4FF00] uppercase">
                        TICKET QR ACTIVO • {sampleClubName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono-tech text-amber-300">
                        <WifiOff className="w-3.5 h-3.5" />
                        Funciona sin señal
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-[#0C0B0A] p-3.5 rounded-xl border border-[#F6F3EC]/10">
                      <div className="sm:col-span-5 flex justify-center">
                        <div className="bg-white p-3 rounded-xl inline-flex flex-col items-center shadow-md">
                          <QrCode className="w-20 h-20 text-black" strokeWidth={1.75} />
                          <span className="text-[9px] font-mono-tech font-extrabold text-black mt-1">
                            BRILLO AL MÁXIMO
                          </span>
                        </div>
                      </div>
                      <div className="sm:col-span-7 space-y-2 text-left">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[10px] font-bold">
                          <span>Canje Parcial • 1 de 2 entregados</span>
                        </div>
                        <p className="text-xs text-[#F6F3EC] font-bold">
                          Saldo disponible en este mismo QR:
                        </p>
                        <div className="p-2 rounded-lg bg-[#161513] border border-[#F6F3EC]/10 flex justify-between text-xs">
                          <span className="text-[#F6F3EC] font-semibold">1x Trago pendiente</span>
                          <span className="text-emerald-400 font-mono-tech font-bold">LISTO</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#B6AFA3]">
                          <Download className="w-3.5 h-3.5 text-[#D4FF00]" />
                          <span>Descarga automática en tus Fotos (PNG)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Stage Footer */}
              <div className="relative z-10 pt-4 border-t border-[#F6F3EC]/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-[#B6AFA3]">
                  {activeStage < 3
                    ? 'Seguí recorriendo las etapas o probalo en vivo abajo.'
                    : '¿Ya estás en el boliche? Entrá directo a la carta.'}
                </span>

                <div className="flex items-center gap-3">
                  {activeStage < 3 ? (
                    <button
                      type="button"
                      onClick={() => setActiveStage((prev) => (prev + 1) % 4)}
                      className="font-mono-tech text-xs font-bold text-[#D4FF00] hover:underline cursor-pointer"
                    >
                      Siguiente etapa (0{activeStage + 2}) →
                    </button>
                  ) : primaryClub ? (
                    <Link
                      href={`/${primaryClub.slug}`}
                      className="font-mono-tech text-xs font-bold text-[#D4FF00] hover:underline"
                    >
                      Abrir carta de {primaryClub.displayName} →
                    </Link>
                  ) : (
                    <a
                      href="#demo-interactiva"
                      className="font-mono-tech text-xs font-bold text-[#D4FF00] hover:underline"
                    >
                      Probar simulador interactivo ↓
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
