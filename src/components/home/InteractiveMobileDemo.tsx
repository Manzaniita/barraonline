'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { generateQrDataUrl } from '@/lib/ticket-generator'
import { HomeClubItem, HomeProductPreview } from './types'
import {
  Plus,
  Minus,
  Search,
  Clock,
  Wine,
  Beer,
  Sparkles,
  Droplets,
  CreditCard,
  QrCode,
  CheckCircle2,
  RotateCcw,
  ArrowUpRight,
  IdCard,
  WifiOff,
  X,
} from 'lucide-react'

const DEMO_FALLBACK_PRODUCTS: HomeProductPreview[] = [
  {
    id: 'demo-fernet',
    name: 'Fernet Branca con Coca-Cola (500ml)',
    description: 'Preparado en barra con hielo en roca. Medida clásica 70/30.',
    category: 'Tragos',
    price: 8500,
    imageUrl: null,
    stockAvailable: 120,
    redeemDeadlineTime: null,
  },
  {
    id: 'demo-gin',
    name: 'Gin Tonic Botánico con Rodaja de Lima',
    description: 'Gin macerado, agua tónica bien fría y bayas de enebro.',
    category: 'Tragos',
    price: 9200,
    imageUrl: null,
    stockAvailable: 85,
    redeemDeadlineTime: '02:30',
  },
  {
    id: 'demo-combo',
    name: 'Combo Botella + 4 Energizantes',
    description: 'Ideal para compartir con tu grupo.Podés retirar todo junto o por partes.',
    category: 'Combos',
    price: 64000,
    imageUrl: null,
    stockAvailable: 12,
    redeemDeadlineTime: null,
  },
  {
    id: 'demo-birra',
    name: 'Cerveza Rubia Helada (Lata 473ml)',
    description: 'Retiro rápido en barra principal o barra terraza.',
    category: 'Cervezas',
    price: 5800,
    imageUrl: null,
    stockAvailable: 90,
    redeemDeadlineTime: null,
  },
  {
    id: 'demo-agua',
    name: 'Agua Mineral sin Gas (500ml)',
    description: 'Botella cerrada fría.',
    category: 'Sin Alcohol',
    price: 3500,
    imageUrl: null,
    stockAvailable: 150,
    redeemDeadlineTime: null,
  },
]

interface InteractiveMobileDemoProps {
  clubs: HomeClubItem[]
}

function buildInitialCart(products: HomeProductPreview[]): Record<string, number> {
  if (products.length === 0) return {}
  const initial: Record<string, number> = { [products[0].id]: 2 }
  if (products[1]) initial[products[1].id] = 1
  return initial
}

export function InteractiveMobileDemo({ clubs }: InteractiveMobileDemoProps) {
  const clubsWithCatalog = useMemo(
    () => clubs.filter((c) => c.featuredProducts.length > 0),
    [clubs]
  )

  const [selectedSourceSlug, setSelectedSourceSlug] = useState<string>(
    clubsWithCatalog[0]?.slug || '__demo__'
  )
  const [screenMode, setScreenMode] = useState<'menu' | 'checkout' | 'ticket'>('menu')
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [demoCart, setDemoCart] = useState<Record<string, number>>(() => {
    const initialProducts =
      clubsWithCatalog[0]?.featuredProducts.length
        ? clubsWithCatalog[0].featuredProducts
        : DEMO_FALLBACK_PRODUCTS
    return buildInitialCart(initialProducts)
  })
  const [redeemedMap, setRedeemedMap] = useState<Record<string, number>>({})
  const [demoQrUrl, setDemoQrUrl] = useState<string>('')
  const [isMaxBrightnessPreview, setIsMaxBrightnessPreview] = useState<boolean>(false)

  const activeRealClub = useMemo(
    () => clubsWithCatalog.find((c) => c.slug === selectedSourceSlug) || null,
    [clubsWithCatalog, selectedSourceSlug]
  )

  const activeProducts = useMemo(() => {
    if (activeRealClub && activeRealClub.featuredProducts.length > 0) {
      return activeRealClub.featuredProducts
    }
    return DEMO_FALLBACK_PRODUCTS
  }, [activeRealClub])

  const handleSelectSource = (slug: string) => {
    setSelectedSourceSlug(slug)
    const targetClub = clubsWithCatalog.find((c) => c.slug === slug)
    const nextProducts =
      targetClub && targetClub.featuredProducts.length > 0
        ? targetClub.featuredProducts
        : DEMO_FALLBACK_PRODUCTS
    setDemoCart(buildInitialCart(nextProducts))
    setRedeemedMap({})
    setSelectedCategory('Todos')
    setSearchTerm('')
    setScreenMode('menu')
  }

  useEffect(() => {
    generateQrDataUrl('BO1/DEMO-MUESTRA-SIN-VALOR-COMERCIAL')
      .then((url) => setDemoQrUrl(url))
      .catch(() => {})
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    activeProducts.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return ['Todos', ...Array.from(set)]
  }, [activeProducts])

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((p) => {
      const matchCat = selectedCategory === 'Todos' || p.category === selectedCategory
      const matchQuery =
        searchTerm.trim() === '' ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      return matchCat && matchQuery
    })
  }, [activeProducts, selectedCategory, searchTerm])

  const cartEntries = useMemo(() => {
    return activeProducts
      .map((product) => ({
        product,
        quantity: demoCart[product.id] || 0,
        redeemed: redeemedMap[product.id] || 0,
      }))
      .filter((entry) => entry.quantity > 0)
  }, [activeProducts, demoCart, redeemedMap])

  const totalCount = useMemo(
    () => cartEntries.reduce((acc, item) => acc + item.quantity, 0),
    [cartEntries]
  )

  const totalRedeemedCount = useMemo(
    () => cartEntries.reduce((acc, item) => acc + item.redeemed, 0),
    [cartEntries]
  )

  const totalAvailableCount = Math.max(0, totalCount - totalRedeemedCount)

  const totalPrice = useMemo(
    () => cartEntries.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [cartEntries]
  )

  const updateDemoQty = (productId: string, delta: number) => {
    setDemoCart((prev) => {
      const current = prev[productId] || 0
      const next = Math.max(0, Math.min(10, current + delta))
      const copy = { ...prev }
      if (next === 0) {
        delete copy[productId]
      } else {
        copy[productId] = next
      }
      return copy
    })
  }

  const handleSimulatePartialRedeem = () => {
    const nextAvailable = cartEntries.find((e) => e.redeemed < e.quantity)
    if (!nextAvailable) return
    setRedeemedMap((prev) => ({
      ...prev,
      [nextAvailable.product.id]: (prev[nextAvailable.product.id] || 0) + 1,
    }))
  }

  const handleResetDemo = () => {
    setRedeemedMap({})
    setScreenMode('menu')
    setIsMaxBrightnessPreview(false)
  }

  const getCategoryIcon = (cat: string) => {
    const lower = cat.toLowerCase()
    if (lower.includes('cerveza') || lower.includes('birra')) return Beer
    if (lower.includes('combo') || lower.includes('botella')) return Sparkles
    if (lower.includes('agua') || lower.includes('sin alcohol')) return Droplets
    return Wine
  }

  return (
    <section
      id="demo-interactiva"
      aria-labelledby="demo-heading"
      className="relative py-20 sm:py-28 border-t border-[#F6F3EC]/10 bg-[#050506]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Columna Editorial Izquierda: Contexto y Controles de la Demostración */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono-tech text-[11px] uppercase tracking-[0.14em]">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Demostración Interactiva • Sin cargos reales</span>
            </div>

            <h2
              id="demo-heading"
              className="font-display-syne text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F6F3EC] leading-[1.04]"
            >
              Probalo ahora:{' '}
              <span className="font-serif-editorial italic font-normal text-[#FF7A33]">
                así se siente pedir desde la pista.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-[#B6AFA3] leading-relaxed">
              Recorré una carta real desde acá mismo. Sumá bebidas, simulá el pago y probá cómo tu código QR descuenta tragos en vivo a medida que los retirás en la barra.
            </p>

            {/* Selector de Fuente de la Carta para la Demo */}
            {clubsWithCatalog.length > 0 && (
              <div className="p-4 rounded-2xl bg-[#11100E] border border-[#F6F3EC]/10 space-y-2.5">
                <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#B6AFA3] block">
                  Carta cargada en el simulador:
                </span>
                <div className="flex flex-wrap gap-2">
                  {clubsWithCatalog.map((club) => (
                    <button
                      key={club.id}
                      type="button"
                      onClick={() => handleSelectSource(club.slug)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedSourceSlug === club.slug
                          ? 'bg-[#D4FF00] text-[#050506]'
                          : 'bg-[#1B1917] text-[#B6AFA3] hover:text-[#F6F3EC] border border-[#F6F3EC]/10'
                      }`}
                    >
                      {club.displayName} (Datos reales)
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSelectSource('__demo__')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedSourceSlug === '__demo__'
                        ? 'bg-[#D4FF00] text-[#050506]'
                        : 'bg-[#1B1917] text-[#B6AFA3] hover:text-[#F6F3EC] border border-[#F6F3EC]/10'
                    }`}
                  >
                    Carta de Muestra
                  </button>
                </div>
              </div>
            )}

            {/* Guía de Pantallas del Simulador */}
            <div className="space-y-2">
              <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#706B62] block">
                Saltá a cualquier pantalla de la experiencia:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScreenMode('menu')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    screenMode === 'menu'
                      ? 'bg-[#1B1917] border-[#D4FF00] text-[#F6F3EC]'
                      : 'bg-[#0D0C0B] border-[#F6F3EC]/10 text-[#B6AFA3] hover:border-[#F6F3EC]/25'
                  }`}
                >
                  <span className="font-mono-tech text-[10px] text-[#D4FF00] block">PASO 1</span>
                  <span className="font-bold text-xs mt-0.5 block">1. La Carta</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (totalCount === 0 && activeProducts[0]) {
                      setDemoCart({ [activeProducts[0].id]: 1 })
                    }
                    setScreenMode('checkout')
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    screenMode === 'checkout'
                      ? 'bg-[#1B1917] border-[#D4FF00] text-[#F6F3EC]'
                      : 'bg-[#0D0C0B] border-[#F6F3EC]/10 text-[#B6AFA3] hover:border-[#F6F3EC]/25'
                  }`}
                >
                  <span className="font-mono-tech text-[10px] text-[#FF7A33] block">PASO 2</span>
                  <span className="font-bold text-xs mt-0.5 block">2. El Pedido</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (totalCount === 0 && activeProducts[0]) {
                      setDemoCart({ [activeProducts[0].id]: 2 })
                    }
                    setScreenMode('ticket')
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    screenMode === 'ticket'
                      ? 'bg-[#1B1917] border-[#D4FF00] text-[#F6F3EC]'
                      : 'bg-[#0D0C0B] border-[#F6F3EC]/10 text-[#B6AFA3] hover:border-[#F6F3EC]/25'
                  }`}
                >
                  <span className="font-mono-tech text-[10px] text-emerald-400 block">PASO 3</span>
                  <span className="font-bold text-xs mt-0.5 block">3. Ticket QR</span>
                </button>
              </div>
            </div>

            {/* Explicación del software para el usuario */}
            <div className="p-4 rounded-2xl bg-[#11100E] border border-[#F6F3EC]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-[#B6AFA3] leading-relaxed">
                <strong className="text-[#F6F3EC] block">Simulador oficial de BarraOnline</strong>
                Probá interactuar con la carta, sumar tragos y simular el canje con el QR para ver cómo funciona el sistema desde cualquier celular.
              </div>
              <a
                href="#buscador-boliches"
                className="fable-interactive inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#181614] hover:bg-[#22201D] border border-[#F6F3EC]/15 hover:border-[#D4FF00]/50 text-[#F6F3EC] font-bold text-xs shrink-0 transition-all"
              >
                <span>Ver boliches adheridos ↑</span>
              </a>
            </div>
          </div>

          {/* Columna Derecha: El Dispositivo Interactivo en Vivo */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-md rounded-[2.25rem] bg-[#0E0D0C] border-2 border-[#F6F3EC]/15 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)] overflow-hidden relative flex flex-col">
              {/* Cinta Superior de Demostración */}
              <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-[11px] font-mono-tech text-amber-200">
                <span>MODO DEMOSTRACIÓN • NO GENERA COBROS</span>
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="inline-flex items-center gap-1 text-amber-300 hover:text-white underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reiniciar</span>
                </button>
              </div>

              {/* Cabecera del Local Recreando StoreHeader Real */}
              <div className="px-4 py-3.5 bg-[#141311] border-b border-[#F6F3EC]/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[#F6F3EC] font-display-syne font-extrabold text-sm shrink-0"
                    style={{
                      backgroundColor: activeRealClub?.primaryColor || '#FF5500',
                    }}
                  >
                    {(activeRealClub?.displayName || 'Barra Nocturna').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-[#F6F3EC] truncate">
                      {activeRealClub?.displayName || 'Club Demo BarraOnline'}
                    </h3>
                    <p className="text-[11px] text-[#FF7A33] truncate">
                      {activeRealClub?.tagline || 'Barra Rápida QR • Simulador Interactivo'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setScreenMode('ticket')}
                  className="px-2.5 py-1.5 rounded-xl bg-[#F6F3EC]/5 hover:bg-[#F6F3EC]/10 border border-[#F6F3EC]/10 text-xs text-[#F6F3EC] flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#D4FF00]" />
                  <span>Mis QR</span>
                </button>
              </div>

              {/* PANTALLA 1: CARTA INTERACTIVA */}
              {screenMode === 'menu' && (
                <div className="flex-1 flex flex-col justify-between min-h-[470px] max-h-[540px]">
                  <div className="p-4 space-y-3 overflow-y-auto flex-1">
                    {/* Buscador interno de la carta */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#B6AFA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar bebida en esta carta de prueba..."
                        aria-label="Buscar bebida en la carta de demostración"
                        className="w-full bg-[#181614] border border-[#F6F3EC]/12 rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#F6F3EC] placeholder-[#706B62] focus:outline-none focus:border-[#D4FF00]"
                      />
                    </div>

                    {/* Categorías */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                            selectedCategory === cat
                              ? 'bg-[#F6F3EC] text-[#050506]'
                              : 'bg-[#181614] text-[#B6AFA3] hover:text-[#F6F3EC] border border-[#F6F3EC]/10'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Lista de Bebidas */}
                    <div className="space-y-2.5 pt-1">
                      {filteredProducts.map((product) => {
                        const qty = demoCart[product.id] || 0
                        const Icon = getCategoryIcon(product.category)
                        return (
                          <div
                            key={product.id}
                            className="p-3.5 rounded-2xl bg-[#161513] border border-[#F6F3EC]/10 flex flex-col gap-2.5 transition-colors hover:border-[#F6F3EC]/25"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F6F3EC]/5 text-[#B6AFA3] text-[10px] font-medium">
                                    <Icon className="w-3 h-3 text-[#FF7A33]" />
                                    {product.category}
                                  </span>
                                  {product.redeemDeadlineTime && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                                      <Clock className="w-2.5 h-2.5" />
                                      Hasta {product.redeemDeadlineTime}
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-bold text-sm text-[#F6F3EC] leading-snug">
                                  {product.name}
                                </h4>
                                {product.description && (
                                  <p className="text-[11px] text-[#B6AFA3] line-clamp-2 mt-0.5">
                                    {product.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-[#F6F3EC]/8 flex items-center justify-between gap-2">
                              <span className="font-mono-tech font-extrabold text-base text-[#F6F3EC]">
                                ${product.price.toLocaleString('es-AR')}
                              </span>

                              {qty === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => updateDemoQty(product.id, 1)}
                                  className="min-h-[38px] px-3.5 rounded-xl bg-[#FF5500] hover:bg-[#ff661a] text-[#F6F3EC] font-bold text-xs inline-flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Agregar</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 bg-[#0B0A09] p-1 rounded-xl border border-[#D4FF00]/40">
                                  <button
                                    type="button"
                                    onClick={() => updateDemoQty(product.id, -1)}
                                    aria-label={`Restar ${product.name}`}
                                    className="w-7 h-7 rounded-lg bg-[#F6F3EC]/10 text-[#F6F3EC] flex items-center justify-center active:scale-90 cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="font-mono-tech font-bold text-xs text-[#D4FF00] min-w-[18px] text-center">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateDemoQty(product.id, 1)}
                                    aria-label={`Sumar ${product.name}`}
                                    className="w-7 h-7 rounded-lg bg-[#D4FF00] text-[#050506] flex items-center justify-center active:scale-90 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Barra Flotante Inferior de Pedido */}
                  <div className="p-3.5 bg-[#141311] border-t border-[#F6F3EC]/12">
                    <button
                      type="button"
                      disabled={totalCount === 0}
                      onClick={() => setScreenMode('checkout')}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#D4FF00] hover:bg-[#e0ff33] disabled:opacity-40 text-[#050506] font-extrabold text-xs flex items-center justify-between shadow-lg transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#050506] text-[#D4FF00] font-mono-tech">
                          {totalCount} {totalCount === 1 ? 'bebida' : 'bebidas'}
                        </span>
                        <span>Revisar pedido y simular pago</span>
                      </div>
                      <span className="font-mono-tech text-sm font-black">
                        ${totalPrice.toLocaleString('es-AR')} →
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* PANTALLA 2: RESUMEN Y SIMULACIÓN DE PAGO */}
              {screenMode === 'checkout' && (
                <div className="p-5 space-y-4 min-h-[470px] flex flex-col justify-between animate-in fade-in duration-200">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-base text-[#F6F3EC]">Tu Pedido de Prueba</h4>
                        <p className="text-xs text-[#B6AFA3]">
                          Verificá las bebidas antes de generar el código QR
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScreenMode('menu')}
                        className="text-xs text-[#D4FF00] hover:underline font-mono-tech cursor-pointer"
                      >
                        ← Seguir eligiendo
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {cartEntries.map(({ product, quantity }) => (
                        <div
                          key={product.id}
                          className="p-3 rounded-xl bg-[#161513] border border-[#F6F3EC]/10 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-[#F6F3EC] truncate">
                              {product.name}
                            </p>
                            <span className="font-mono-tech text-xs text-[#FF7A33]">
                              ${(product.price * quantity).toLocaleString('es-AR')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 bg-[#0B0A09] p-1 rounded-lg border border-[#F6F3EC]/10">
                            <button
                              type="button"
                              onClick={() => updateDemoQty(product.id, -1)}
                              className="w-6 h-6 rounded bg-[#F6F3EC]/10 text-[#F6F3EC] flex items-center justify-center text-xs cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-mono-tech text-xs font-bold px-1">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateDemoQty(product.id, 1)}
                              className="w-6 h-6 rounded bg-[#D4FF00] text-[#050506] flex items-center justify-center text-xs font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Identificación DNI demostrativa */}
                    <div className="p-3.5 rounded-xl bg-[#161513] border border-emerald-500/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <IdCard className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#F6F3EC]">
                            Titular: Cliente Demo • DNI 42.890.123
                          </p>
                          <p className="text-[11px] text-[#B6AFA3]">
                            Tus tragos quedan asociados a tu documento como respaldo
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#F6F3EC]/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#B6AFA3]">Total demostrativo</span>
                      <span className="text-xl font-extrabold font-mono-tech text-[#F6F3EC]">
                        ${totalPrice.toLocaleString('es-AR')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setRedeemedMap({})
                        setScreenMode('ticket')
                      }}
                      className="w-full py-3.5 px-4 rounded-xl bg-[#009EE3] hover:bg-[#008fd0] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Simular Pago con Mercado Pago y Ver QR</span>
                    </button>
                  </div>
                </div>
              )}

              {/* PANTALLA 3: TICKET QR INTERACTIVO Y CANJE PARCIAL */}
              {screenMode === 'ticket' && (
                <div className="p-5 space-y-3.5 min-h-[470px] flex flex-col justify-between animate-in fade-in duration-200">
                  {/* Aviso offline */}
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2.5 text-left">
                    <WifiOff className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-200 leading-snug">
                      <strong>En una compra real:</strong> este ticket se descarga automáticamente en tus Fotos para que lo presentes aunque se corte el 4G adentro del boliche.
                    </p>
                  </div>

                  {/* Card del Ticket */}
                  <div className="p-4 rounded-2xl bg-[#161513] border-2 border-[#D4FF00]/50 text-center space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-mono-tech">
                      <span className="text-[#D4FF00] font-bold">
                        {totalAvailableCount === 0
                          ? '✓ CANJE COMPLETO'
                          : totalRedeemedCount > 0
                          ? `⚡ CANJE PARCIAL (${totalRedeemedCount}/${totalCount})`
                          : '● QR ACTIVO LISTO PARA BARRA'}
                      </span>
                      <span className="text-[#B6AFA3]">
                        Cierre {activeRealClub?.defaultExpirationHour || '07:00'} hs
                      </span>
                    </div>

                    {/* QR Box */}
                    <div
                      onClick={() => setIsMaxBrightnessPreview(true)}
                      className="bg-white p-3 rounded-2xl inline-block shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
                    >
                      {demoQrUrl ? (
                        <img
                          src={demoQrUrl}
                          alt="Código QR de demostración"
                          style={{ imageRendering: 'pixelated' }}
                          className="w-36 h-36 mx-auto object-contain"
                        />
                      ) : (
                        <div className="w-36 h-36 flex items-center justify-center text-black">
                          <QrCode className="w-12 h-12" />
                        </div>
                      )}
                      <span className="text-[9px] font-mono-tech font-extrabold text-black/80 block pt-1">
                        TOCÁ PARA MODO BRILLO MÁXIMO
                      </span>
                    </div>

                    {/* Saldo disponible en este QR */}
                    <div className="text-left bg-[#0C0B0A] p-3 rounded-xl border border-[#F6F3EC]/10 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono-tech uppercase text-[#B6AFA3]">
                          Saldo en este QR:
                        </span>
                        <span className="font-bold text-[#D4FF00]">
                          {totalAvailableCount}{' '}
                          {totalAvailableCount === 1 ? 'bebida disponible' : 'bebidas disponibles'}
                        </span>
                      </div>
                      {cartEntries.map(({ product, quantity, redeemed }) => {
                        const rem = Math.max(0, quantity - redeemed)
                        return (
                          <div
                            key={product.id}
                            className="flex items-center justify-between text-xs pt-1 border-t border-[#F6F3EC]/8"
                          >
                            <span
                              className={
                                rem === 0
                                  ? 'line-through text-[#706B62]'
                                  : 'text-[#F6F3EC] font-semibold'
                              }
                            >
                              {rem}x {product.name}
                            </span>
                            <span className="font-mono-tech text-[11px] text-emerald-400">
                              {redeemed > 0 ? `${redeemed} retirado(s)` : 'Pendiente'}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Botón interactivo para probar el Canje Parcial */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={totalAvailableCount === 0}
                        onClick={handleSimulatePartialRedeem}
                        className="py-2.5 px-3 rounded-xl bg-[#D4FF00] hover:bg-[#e0ff33] disabled:opacity-40 text-[#050506] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {totalAvailableCount > 0
                            ? 'Simular retiro de 1 trago'
                            : 'Todos los tragos retirados'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setScreenMode('menu')}
                        className="py-2.5 px-3 rounded-xl bg-[#F6F3EC]/10 hover:bg-[#F6F3EC]/15 text-[#F6F3EC] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <span>Volver a la carta</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal interno de Brillo Máximo para Barra */}
              {isMaxBrightnessPreview && (
                <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => setIsMaxBrightnessPreview(false)}
                    aria-label="Cerrar vista de brillo máximo"
                    className="absolute top-4 right-4 p-2.5 rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <span className="font-mono-tech text-[11px] uppercase tracking-widest text-[#D4FF00] mb-3">
                    VISTA DE ESCANEO RÁPIDO EN BARRA
                  </span>
                  <div className="bg-white p-5 rounded-3xl shadow-2xl">
                    {demoQrUrl && (
                      <img
                        src={demoQrUrl}
                        alt="QR Pantalla Completa"
                        style={{ imageRendering: 'pixelated' }}
                        className="w-52 h-52 object-contain"
                      />
                    )}
                  </div>
                  <p className="text-xs text-white/70 mt-4 max-w-xs">
                    Alto contraste para que el lector de la barra lo lea en menos de un segundo, incluso con luces bajas.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
