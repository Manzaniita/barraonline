'use client'

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { HomeClubItem, HomeSessionUser } from './types'
import { VisualStoryTimeline } from './VisualStoryTimeline'
import { InteractiveMobileDemo } from './InteractiveMobileDemo'
import { CustomerAuthModal } from '@/components/store/CustomerAuthModal'
import { getSavedCustomerProfile, CustomerProfile } from '@/lib/customer-session'
import { getSavedTickets } from '@/lib/ticket-generator'
import {
  Search,
  QrCode,
  ArrowUpRight,
  ArrowRight,
  Clock,
  Wine,
  UserCheck,
  UserPlus,
  X,
  WifiOff,
  CreditCard,
  IdCard,
  Settings,
  ShieldCheck,
  Sparkles,
  CornerDownLeft,
} from 'lucide-react'

interface HomeExperienceClientProps {
  clubs: HomeClubItem[]
  initialUser: HomeSessionUser | null
  canAccessSuperAdmin: boolean
}

export function HomeExperienceClient({
  clubs,
  initialUser,
  canAccessSuperAdmin,
}: HomeExperienceClientProps) {
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchSectionRef = useRef<HTMLElement | null>(null)

  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0)
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery)
    setHighlightedIndex(0)
  }

  const handleFilterChange = (nextFilter: string) => {
    setActiveFilter(nextFilter)
    setHighlightedIndex(0)
  }

  // Sesión del cliente sincronizada + Modal de Cuenta
  const [customer, setCustomer] = useState<CustomerProfile | null>(() => {
    if (initialUser) {
      return {
        userId: initialUser.id,
        fullName: initialUser.fullName || 'Mi Cuenta',
        dni: initialUser.dni || '',
        email: initialUser.email || undefined,
        phone: initialUser.phone || undefined,
        role: (initialUser.role as CustomerProfile['role']) || 'CUSTOMER',
        tenantSlug: initialUser.tenantSlug || undefined,
      }
    }
    return getSavedCustomerProfile()
  })
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  // Detectar si el cliente ya tiene tickets QR activos guardados en su celular
  const [localActiveTickets] = useState<{
    slug: string
    clubName: string
    count: number
  } | null>(() => {
    if (typeof window === 'undefined') return null
    const now = new Date()
    for (const club of clubs) {
      const tickets = getSavedTickets(club.slug)
      const active = tickets.filter((t) => {
        const notExpired = new Date(t.expiresAt) > now
        const totalBought = t.items.reduce((acc, i) => acc + i.quantity, 0)
        const totalRedeemed = t.items.reduce((acc, i) => acc + (i.quantityRedeemed || 0), 0)
        return notExpired && totalRedeemed < totalBought
      })
      if (active.length > 0) {
        return {
          slug: club.slug,
          clubName: club.displayName,
          count: active.length,
        }
      }
    }
    return null
  })

  const focusClubFinder = useCallback(() => {
    searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 220)
  }, [])

  // Atajo de teclado global "/" o "Cmd/Ctrl + K" para ir directo al buscador de boliches
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isTypingInInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (
        (e.key === '/' && !isTypingInInput) ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault()
        focusClubFinder()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [focusClubFinder])

  // Categorías reales presentes en los boliches activos
  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    clubs.forEach((c) => {
      c.categories.forEach((cat) => set.add(cat))
    })
    return Array.from(set).slice(0, 5)
  }, [clubs])

  // Filtrado en tiempo real de boliches por nombre, slug, tagline o bebida de su carta
  const filteredClubs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clubs.filter((club) => {
      if (activeFilter === 'with-menu' && club.productCount === 0) return false
      if (activeFilter === 'mercadopago' && !club.hasMercadoPago) return false
      if (
        activeFilter.startsWith('cat:') &&
        !club.categories.includes(activeFilter.replace('cat:', ''))
      ) {
        return false
      }

      if (!q) return true

      const matchesName =
        club.displayName.toLowerCase().includes(q) ||
        club.name.toLowerCase().includes(q) ||
        club.slug.toLowerCase().includes(q) ||
        club.tagline.toLowerCase().includes(q)

      const matchesDrink =
        club.categories.some((cat) => cat.toLowerCase().includes(q)) ||
        club.featuredProducts.some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        )

      return matchesName || matchesDrink
    })
  }, [clubs, query, activeFilter])

  // Navegación con teclado dentro del buscador protagonista
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredClubs.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredClubs.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredClubs.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + filteredClubs.length) % filteredClubs.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredClubs[highlightedIndex] || filteredClubs[0]
      if (selected) {
        router.push(`/${selected.slug}`)
      }
    } else if (e.key === 'Escape') {
      setQuery('')
      setHighlightedIndex(0)
      searchInputRef.current?.blur()
    }
  }

  const primaryClub = useMemo(() => {
    if (customer?.tenantSlug) {
      const found = clubs.find((c) => c.slug === customer.tenantSlug)
      if (found) return found
    }
    return clubs[0] || null
  }, [clubs, customer])

  return (
    <div className="min-h-screen bg-[#050506] text-[#F6F3EC] flex flex-col selection:bg-[#D4FF00] selection:text-[#050506] relative pb-20 sm:pb-0">
      {/* Textura analógica sutil de grano 35mm */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.028] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Banner superior vivo si el usuario ya tiene un QR activo en su teléfono */}
      {localActiveTickets && (
        <div className="bg-[#D4FF00] text-[#050506] px-4 py-2 text-xs font-bold border-b border-black/15">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#050506] animate-ping" />
              <span>
                Tenés {localActiveTickets.count}{' '}
                {localActiveTickets.count === 1 ? 'ticket QR activo' : 'tickets QR activos'} en{' '}
                <strong>{localActiveTickets.clubName}</strong>
              </span>
            </div>
            <Link
              href={`/${localActiveTickets.slug}/mis-tragos`}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#050506] text-[#D4FF00] font-mono-tech text-[11px] uppercase tracking-wider shrink-0"
            >
              <span>Abrir mi QR</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ================= NAVBAR NOCTURNA EDITORIAL ================= */}
      <header className="sticky top-0 z-40 bg-[#050506]/85 backdrop-blur-xl border-b border-[#F6F3EC]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Identidad de Marca BarraOnline */}
          <Link
            href="/"
            className="group flex items-center gap-3 focus:outline-none"
            aria-label="BarraOnline Inicio"
          >
            <div className="w-10 h-10 rounded-xl bg-[#141311] border border-[#F6F3EC]/15 group-hover:border-[#D4FF00] flex items-center justify-center transition-colors relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-1 bg-[#FF5500]" />
              <span className="font-display-syne font-extrabold text-sm tracking-tighter text-[#F6F3EC]">
                BO
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4FF00] absolute top-2 right-2" />
            </div>
            <div>
              <span className="font-display-syne font-extrabold text-lg sm:text-xl tracking-tight text-[#F6F3EC] block leading-none">
                BARRA<span className="font-serif-editorial italic font-normal text-[#D4FF00] ml-0.5">online</span>
              </span>
              <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-[#706B62] block mt-0.5">
                Menos fila • Más noche
              </span>
            </div>
          </Link>

          {/* Enlaces de Navegación Rápida (Escritorio) */}
          <nav
            aria-label="Secciones principales"
            className="hidden md:flex items-center gap-7 text-xs font-medium text-[#B6AFA3]"
          >
            <a href="#buscador-boliches" className="hover:text-[#D4FF00] transition-colors">
              Boliches adheridos
            </a>
            <a href="#como-funciona" className="hover:text-[#D4FF00] transition-colors">
              Cómo se pide
            </a>
            <a href="#demo-interactiva" className="hover:text-[#D4FF00] transition-colors">
              Probar la carta
            </a>
            <a href="#beneficios-noche" className="hover:text-[#D4FF00] transition-colors">
              En la barra
            </a>
          </nav>

          {/* Acciones del Usuario y Búsqueda Rápida */}
          <div className="flex items-center gap-2">
            {/* Botón Disparador de Búsqueda */}
            <button
              type="button"
              onClick={focusClubFinder}
              className="hidden sm:inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#131210] hover:bg-[#1B1917] border border-[#F6F3EC]/12 text-xs text-[#B6AFA3] hover:text-[#F6F3EC] transition-all cursor-pointer"
              aria-label="Buscar boliche"
            >
              <Search className="w-3.5 h-3.5 text-[#D4FF00]" />
              <span>Buscar boliche...</span>
              <kbd className="font-mono-tech text-[10px] px-1.5 py-0.5 rounded bg-[#050506] text-[#706B62] border border-[#F6F3EC]/10">
                /
              </kbd>
            </button>

            {/* Acceso directo a Mis QRs si hay un local activo */}
            {primaryClub && (
              <Link
                href={`/${primaryClub.slug}/mis-tragos`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#131210] hover:bg-[#1B1917] border border-[#F6F3EC]/12 text-xs font-semibold text-[#F6F3EC] transition-colors"
                title="Ver mis códigos QR"
              >
                <QrCode className="w-3.5 h-3.5 text-[#D4FF00]" />
                <span className="hidden sm:inline">Mis QRs</span>
              </Link>
            )}

            {/* Acceso a Mi Cuenta (Modal rápido o página /mi-cuenta) */}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#131210] hover:bg-[#1B1917] border border-[#F6F3EC]/12 text-xs font-semibold text-[#F6F3EC] transition-colors cursor-pointer"
            >
              {customer ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-[#D4FF00]" />
                  <span className="max-w-[90px] truncate">
                    {customer.fullName.split(' ')[0]}
                  </span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 text-[#FF7A33]" />
                  <span>Ingresar</span>
                </>
              )}
            </button>

            {/* CTA Primario: Ir a la Carta o Buscar Boliche */}
            {primaryClub ? (
              <Link
                href={`/${primaryClub.slug}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#e1ff33] text-[#050506] font-extrabold text-xs transition-all active:scale-95"
              >
                <span>Pedir ahora</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={focusClubFinder}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#e1ff33] text-[#050506] font-extrabold text-xs transition-all active:scale-95 cursor-pointer"
              >
                <span>Buscar boliche</span>
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ================= A. APERTURA QUE DETIENE EL SCROLL ================= */}
        <section
          aria-labelledby="hero-heading"
          className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28 overflow-hidden"
        >
          {/* Luz ambiental cálida de club nocturno */}
          <div
            className="absolute -top-40 left-1/4 w-[38rem] h-[38rem] rounded-full pointer-events-none blur-3xl opacity-35 animate-pulse-beam"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 85, 0, 0.36) 0%, rgba(245, 158, 11, 0.12) 45%, transparent 72%)',
            }}
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Micro-barra editorial superior con coordenadas de la noche */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-[#F6F3EC]/10 text-[11px] font-mono-tech text-[#B6AFA3]">
              <div className="flex items-center gap-2.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#D4FF00]" />
                <span className="uppercase tracking-[0.18em] text-[#F6F3EC]">
                  LA NOCHE, SIN INTERRUPCIONES
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span>PEDÍ DESDE EL CELULAR</span>
                <span className="text-[#706B62]">/</span>
                <span className="text-[#D4FF00]">RETIRÁ CON QR EN BARRA</span>
              </div>
            </div>

            {/* Composición Editorial Asimétrica */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Columna Tipográfica Expresiva (7 columnas en desktop) */}
              <div className="lg:col-span-7 space-y-7">
                <h1
                  id="hero-heading"
                  className="font-display-syne font-extrabold text-[2.65rem] sm:text-6xl lg:text-[4.65rem] leading-[0.96] tracking-tight text-[#F6F3EC]"
                >
                  LA NOCHE SIGUE.{' '}
                  <span className="block mt-1 font-serif-editorial italic font-normal text-[#D4FF00] text-[3.1rem] sm:text-7xl lg:text-[5.4rem] leading-[0.94]">
                    La fila no.
                  </span>
                </h1>

                <p className="text-base sm:text-xl text-[#B6AFA3] max-w-xl leading-relaxed font-normal">
                  <strong className="text-[#F6F3EC] font-semibold">
                    Menos fila. Más noche. Tu trago, desde el celular.
                  </strong>{' '}
                  Entrá a la carta de tu boliche, elegí qué tomar con precios claros, pagá con Mercado Pago y pasá por la barra solo a retirar con tu QR.
                </p>

                {/* Buscador Instantáneo Directo en Primera Pantalla + Accesos a Locales */}
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5 p-2 rounded-2xl bg-[#131210] border border-[#F6F3EC]/15 focus-within:border-[#D4FF00] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] transition-colors">
                    <div className="flex items-center gap-3 px-3.5 py-2 flex-1">
                      <Search className="w-5 h-5 text-[#D4FF00] shrink-0" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Buscá tu boliche o bebida ahora mismo..."
                        aria-label="Buscar boliche desde el inicio"
                        className="w-full bg-transparent text-sm sm:text-base text-[#F6F3EC] placeholder-[#706B62] focus:outline-none"
                      />
                      {query && (
                        <button
                          type="button"
                          onClick={() => handleQueryChange('')}
                          aria-label="Borrar texto"
                          className="p-1 rounded-lg text-[#B6AFA3] hover:text-[#F6F3EC] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {primaryClub && !query ? (
                      <Link
                        href={`/${primaryClub.slug}`}
                        className="min-h-[48px] px-5 py-3 rounded-xl bg-[#D4FF00] hover:bg-[#e2ff38] text-[#050506] font-display-syne font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 transition-all active:scale-[0.99]"
                      >
                        <span>Entrar a {primaryClub.displayName}</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={focusClubFinder}
                        className="min-h-[48px] px-5 py-3 rounded-xl bg-[#D4FF00] hover:bg-[#e2ff38] text-[#050506] font-display-syne font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <span>Ver resultados ({filteredClubs.length})</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Resultados rápidos al escribir en el Hero o Chips de Boliches Activos */}
                  {query.trim().length > 0 ? (
                    <div className="rounded-2xl bg-[#141311] border border-[#D4FF00]/40 p-3 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-[11px] font-mono-tech text-[#B6AFA3] px-1">
                        <span>COINCIDENCIAS EN VIVO ({filteredClubs.length})</span>
                        <span>ENTER PARA ABRIR CARTA</span>
                      </div>
                      {filteredClubs.length > 0 ? (
                        <div className="space-y-1.5">
                          {filteredClubs.slice(0, 3).map((c, idx) => (
                            <Link
                              key={c.id}
                              href={`/${c.slug}`}
                              className={`p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                                idx === highlightedIndex
                                  ? 'bg-[#1F1D1A] border border-[#D4FF00]/50'
                                  : 'bg-[#0C0B0A] hover:bg-[#191715] border border-[#F6F3EC]/8'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold text-[#F6F3EC] shrink-0"
                                  style={{ backgroundColor: c.primaryColor }}
                                >
                                  {c.displayName.charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[#F6F3EC] truncate">
                                    {c.displayName}
                                  </p>
                                  <span className="text-[10px] font-mono-tech text-[#B6AFA3] block">
                                    /{c.slug} • {c.productCount} bebidas en carta
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono-tech text-xs font-bold text-[#D4FF00] shrink-0">
                                Abrir carta →
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#B6AFA3] px-1 py-1">
                          No hay locales que coincidan con &ldquo;{query}&rdquo;.
                        </p>
                      )}
                    </div>
                  ) : (
                    clubs.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono-tech text-[11px] text-[#706B62] uppercase tracking-wider">
                          Abiertos hoy:
                        </span>
                        {clubs.slice(0, 4).map((c) => (
                          <Link
                            key={c.id}
                            href={`/${c.slug}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#131210] hover:bg-[#1C1A17] border border-[#F6F3EC]/12 hover:border-[#D4FF00]/50 text-[#F6F3EC] font-medium transition-colors"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{c.displayName}</span>
                            <ArrowUpRight className="w-3 h-3 text-[#D4FF00]" />
                          </Link>
                        ))}
                        <a
                          href="#demo-interactiva"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-transparent hover:bg-[#F6F3EC]/5 text-[#B6AFA3] hover:text-[#D4FF00] font-mono-tech text-[11px] transition-colors"
                        >
                          <span>Probar carta interactiva ↓</span>
                        </a>
                      </div>
                    )
                  )}
                </div>

                {/* Micro-píldoras de Verdades Concretas para el Cliente */}
                <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#F6F3EC]/10 text-xs">
                  <div className="flex items-center gap-2.5 text-[#B6AFA3]">
                    <span className="w-2 h-2 rounded-full bg-[#FF5500] shrink-0" />
                    <span>Sin bajar apps • Directo del navegador</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[#B6AFA3]">
                    <span className="w-2 h-2 rounded-full bg-[#D4FF00] shrink-0" />
                    <span>El QR se guarda en Fotos (funciona sin 4G)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[#B6AFA3]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span>Retirá todo junto o de a un trago</span>
                  </div>
                </div>
              </div>

              {/* Columna Visual Cinematográfica (5 columnas en desktop) */}
              <div className="lg:col-span-5 relative">
                {/* Fotografía Principal de Club Nocturno */}
                <div className="relative rounded-3xl overflow-hidden border border-[#F6F3EC]/15 bg-[#121110] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)] aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5]">
                  <Image
                    src="/editorial/hero-nightlife.jpg"
                    alt="Ambiente nocturno en la barra de un club contemporáneo"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    className="object-cover object-center scale-[1.02]"
                  />
                  {/* Degradado cinematográfico para legibilidad */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/35 to-transparent" />

                  {/* Marcas de encuadre editoriales */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-[10px] font-mono-tech text-[#F6F3EC]/80">
                    <span className="px-2.5 py-1 rounded-md bg-black/65 backdrop-blur-md border border-white/10">
                      [ BARRA SIN FILA • 02:15 AM ]
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-black/65 backdrop-blur-md border border-white/10 text-[#D4FF00]">
                      QR OFFLINE LISTO
                    </span>
                  </div>

                  {/* Tarjeta superpuesta: El Trago + El Pase QR en Mano */}
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-[#0D0C0B]/92 backdrop-blur-xl border border-[#F6F3EC]/15 p-4 shadow-2xl">
                    <div className="flex items-center gap-3.5">
                      <Image
                        src="/editorial/craft-cocktail.jpg"
                        alt="Tragos servidos en barra"
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-xl object-cover border border-[#F6F3EC]/15 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#D4FF00]">
                            PEDIDO LISTO PARA RETIRAR
                          </span>
                          <span className="font-mono-tech text-[10px] text-[#B6AFA3]">
                            SIN SEÑAL OK
                          </span>
                        </div>
                        <p className="font-bold text-sm text-[#F6F3EC] truncate mt-0.5">
                          {primaryClub?.featuredProducts[0]?.name || '2x Fernet + 1x Gin Tonic'}
                        </p>
                        <p className="text-xs text-[#B6AFA3] mt-0.5">
                          Mostrás el QR desde tu galería de Fotos y retirás en barra.
                        </p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white text-black flex items-center justify-center shrink-0 shadow-md">
                        <QrCode className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= B & C. BUSCADOR PROTAGONISTA Y DESCUBRIMIENTO DE LOCALES ================= */}
        <section
          id="buscador-boliches"
          ref={searchSectionRef}
          aria-labelledby="finder-heading"
          className="relative py-16 sm:py-24 border-t border-[#F6F3EC]/12 bg-[#0B0A09]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            {/* Cabecera del Buscador Protagonista */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 font-mono-tech text-xs uppercase tracking-[0.18em] text-[#D4FF00] mb-3">
                  <span>[ DESCUBRÍ DÓNDE PEDIR HOY ]</span>
                </div>
                <h2
                  id="finder-heading"
                  className="font-display-syne text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F6F3EC]"
                >
                  Encontrá tu boliche y{' '}
                  <span className="font-serif-editorial italic font-normal text-[#FF7A33]">
                    abrí la carta.
                  </span>
                </h2>
              </div>

              <p className="text-xs sm:text-sm text-[#B6AFA3] max-w-md">
                Buscá por el nombre del local o por lo que tenés ganas de tomar. Usá las flechas del teclado y <kbd className="font-mono-tech px-1.5 py-0.5 rounded bg-[#181614] border border-[#F6F3EC]/15 text-[#F6F3EC]">Enter</kbd> para entrar directo.
              </p>
            </div>

            {/* EL BUSCADOR PROTAGONISTA */}
            <div className="space-y-4">
              <div
                className={`relative rounded-2xl sm:rounded-3xl bg-[#141311] border-2 transition-all duration-200 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] ${
                  isSearchFocused
                    ? 'border-[#D4FF00] shadow-[0_0_50px_-12px_rgba(212,255,0,0.28)]'
                    : 'border-[#F6F3EC]/15 hover:border-[#F6F3EC]/30'
                }`}
              >
                <div className="flex items-center px-4 sm:px-6 py-4 sm:py-5 gap-3.5">
                  <Search
                    className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 transition-colors ${
                      isSearchFocused ? 'text-[#D4FF00]' : 'text-[#FF7A33]'
                    }`}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Escribí el nombre del boliche o una bebida (ej. Fernet, Gin, Combo)..."
                    aria-label="Buscar boliche por nombre o bebida"
                    className="w-full bg-transparent text-base sm:text-xl font-medium text-[#F6F3EC] placeholder-[#706B62] focus:outline-none"
                  />

                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        handleQueryChange('')
                        searchInputRef.current?.focus()
                      }}
                      aria-label="Limpiar búsqueda"
                      className="p-2 rounded-xl bg-[#F6F3EC]/10 hover:bg-[#F6F3EC]/20 text-[#F6F3EC] transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {filteredClubs[highlightedIndex] && (
                    <Link
                      href={`/${filteredClubs[highlightedIndex].slug}`}
                      className="hidden md:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4FF00] hover:bg-[#e1ff33] text-[#050506] font-extrabold text-xs shrink-0 transition-colors"
                    >
                      <span>Abrir {filteredClubs[highlightedIndex].displayName}</span>
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                {/* Barra de Filtros Reales del Sistema */}
                <div className="px-4 sm:px-6 py-3 bg-[#0E0D0C] border-t border-[#F6F3EC]/10 rounded-b-2xl sm:rounded-b-3xl flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => handleFilterChange('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        activeFilter === 'all'
                          ? 'bg-[#F6F3EC] text-[#050506]'
                          : 'bg-[#181614] text-[#B6AFA3] hover:text-[#F6F3EC] border border-[#F6F3EC]/10'
                      }`}
                    >
                      Todos ({clubs.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFilterChange('with-menu')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        activeFilter === 'with-menu'
                          ? 'bg-[#D4FF00] text-[#050506]'
                          : 'bg-[#181614] text-[#B6AFA3] hover:text-[#F6F3EC] border border-[#F6F3EC]/10'
                      }`}
                    >
                      Con carta activa
                    </button>

                    {clubs.some((c) => c.hasMercadoPago) && (
                      <button
                        type="button"
                        onClick={() => handleFilterChange('mercadopago')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                          activeFilter === 'mercadopago'
                            ? 'bg-[#009EE3] text-white'
                            : 'bg-[#181614] text-[#B6AFA3] hover:text-[#F6F3EC] border border-[#F6F3EC]/10'
                        }`}
                      >
                        Mercado Pago habilitado
                      </button>
                    )}

                    {availableCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          handleFilterChange(activeFilter === `cat:${cat}` ? 'all' : `cat:${cat}`)
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                          activeFilter === `cat:${cat}`
                            ? 'bg-[#FF5500] text-[#F6F3EC]'
                            : 'bg-[#181614] text-[#B6AFA3] hover:text-[#F6F3EC] border border-[#F6F3EC]/10'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <span className="font-mono-tech text-[11px] text-[#706B62] hidden lg:inline">
                    ↑↓ NAVEGAR • ENTER PARA ENTRAR A LA CARTA
                  </span>
                </div>
              </div>
            </div>

            {/* ================= C. EXPERIENCIA EDITORIAL DE DESCUBRIMIENTO DE LOCALES ================= */}
            {clubs.length === 0 ? (
              /* Estado cuando aún no hay locales activos en la base de datos */
              <div className="rounded-3xl bg-[#131210] border border-[#F6F3EC]/12 p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-[#FF5500]/15 border border-[#FF5500]/30 text-[#FF7A33] flex items-center justify-center mx-auto">
                  <Wine className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display-syne text-2xl font-extrabold text-[#F6F3EC]">
                    No hay barras abiertas en este momento
                  </h3>
                  <p className="text-sm text-[#B6AFA3] leading-relaxed">
                    Los boliches adheridos aparecen acá automáticamente cuando habilitan su carta para la noche. Mientras tanto, podés probar el simulador interactivo o revisar tus compras anteriores en tu cuenta.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <a
                    href="#demo-interactiva"
                    className="px-5 py-3 rounded-xl bg-[#D4FF00] text-[#050506] font-extrabold text-xs inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Probar carta de demostración</span>
                  </a>
                  <Link
                    href="/mi-cuenta"
                    className="px-5 py-3 rounded-xl bg-[#1B1917] border border-[#F6F3EC]/15 text-[#F6F3EC] font-bold text-xs inline-flex items-center gap-2"
                  >
                    <UserCheck className="w-4 h-4 text-[#FF7A33]" />
                    <span>Ir a Mi Cuenta</span>
                  </Link>
                  {canAccessSuperAdmin && (
                    <Link
                      href="/superadmin"
                      className="px-5 py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold text-xs inline-flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Panel SuperAdmin</span>
                    </Link>
                  )}
                </div>
              </div>
            ) : filteredClubs.length === 0 ? (
              /* Estado Vacío Útil cuando la búsqueda no arroja coincidencias */
              <div className="rounded-3xl bg-[#131210] border border-[#F6F3EC]/12 p-8 sm:p-10 text-center max-w-xl mx-auto space-y-4">
                <p className="font-mono-tech text-xs uppercase tracking-widest text-[#FF7A33]">
                  SIN COINCIDENCIAS PARA &ldquo;{query}&rdquo;
                </p>
                <h3 className="font-display-syne text-xl sm:text-2xl font-extrabold text-[#F6F3EC]">
                  No encontramos ningún boliche ni bebida con ese nombre.
                </h3>
                <p className="text-xs sm:text-sm text-[#B6AFA3]">
                  Probá buscando por otra palabra o mostrale todos los establecimientos adheridos disponibles hoy.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleQueryChange('')
                      handleFilterChange('all')
                      searchInputRef.current?.focus()
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#D4FF00] text-[#050506] font-extrabold text-xs cursor-pointer"
                  >
                    Ver todos los locales ({clubs.length})
                  </button>
                  <a
                    href="#demo-interactiva"
                    className="px-5 py-2.5 rounded-xl bg-[#1B1917] border border-[#F6F3EC]/15 text-[#F6F3EC] font-bold text-xs"
                  >
                    Probar carta interactiva
                  </a>
                </div>
              </div>
            ) : (
              /* Presentación Editorial de Locales (Funciona tanto para 1 único local como para múltiples) */
              <div className="space-y-6">
                <div
                  className={
                    filteredClubs.length === 1
                      ? 'grid grid-cols-1 gap-6'
                      : 'grid grid-cols-1 lg:grid-cols-12 gap-6'
                  }
                >
                  {filteredClubs.map((club, index) => {
                    const isHighlighted = index === highlightedIndex
                    const isFeaturedLarge = filteredClubs.length === 1 || index === 0

                    return (
                      <article
                        key={club.id}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`group relative rounded-3xl overflow-hidden transition-all duration-300 border flex flex-col justify-between ${
                          filteredClubs.length === 1
                            ? 'bg-[#141311]'
                            : isFeaturedLarge
                            ? 'lg:col-span-7 bg-[#141311]'
                            : 'lg:col-span-5 bg-[#12110F]'
                        } ${
                          isHighlighted
                            ? 'border-[#D4FF00]/60 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)]'
                            : 'border-[#F6F3EC]/12 hover:border-[#F6F3EC]/30'
                        }`}
                      >
                        {/* Cabecera Visual / Identidad Propia del Establecimiento */}
                        <div className="relative p-6 sm:p-8 border-b border-[#F6F3EC]/10 overflow-hidden">
                          {/* Si el local tiene bannerUrl configurado, lo muestra con tratamiento nocturno; si no, crea una atmósfera lumínica con el color real del local */}
                          {club.bannerUrl ? (
                            <>
                              <img
                                src={club.bannerUrl}
                                alt={club.displayName}
                                className="absolute inset-0 w-full h-full object-cover opacity-35 group-hover:scale-105 transition-transform duration-700"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#141311] via-[#141311]/80 to-[#141311]/40" />
                            </>
                          ) : (
                            <div
                              className="absolute inset-0 opacity-25 pointer-events-none transition-opacity group-hover:opacity-35"
                              style={{
                                background: `radial-gradient(circle at 85% 20%, ${club.primaryColor}, transparent 60%), radial-gradient(circle at 15% 80%, ${club.secondaryColor}, transparent 65%)`,
                              }}
                            />
                          )}

                          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              {club.logoUrl && club.logoUrl !== '/favicon.ico' ? (
                                <img
                                  src={club.logoUrl}
                                  alt={club.displayName}
                                  className="w-16 h-16 rounded-2xl object-cover border border-[#F6F3EC]/20 shrink-0 shadow-lg"
                                />
                              ) : (
                                <div
                                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-[#F6F3EC] font-display-syne font-extrabold text-2xl shrink-0 border border-white/20 shadow-lg"
                                  style={{
                                    background: `linear-gradient(135deg, ${club.primaryColor}, ${club.secondaryColor})`,
                                  }}
                                >
                                  {club.displayName.charAt(0).toUpperCase()}
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono-tech text-[10px] font-bold uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Barra Habilitada
                                  </span>

                                  <span className="font-mono-tech text-[11px] text-[#B6AFA3] bg-[#090908]/80 px-2.5 py-0.5 rounded-full border border-[#F6F3EC]/10">
                                    /{club.slug}
                                  </span>

                                  {club.hasMercadoPago && (
                                    <span className="font-mono-tech text-[10px] text-[#38BDF8] bg-[#009EE3]/15 border border-[#009EE3]/30 px-2.5 py-0.5 rounded-full font-bold">
                                      Mercado Pago
                                    </span>
                                  )}
                                </div>

                                <h3 className="font-display-syne text-2xl sm:text-3xl font-extrabold text-[#F6F3EC] tracking-tight">
                                  {club.displayName}
                                </h3>

                                <p className="text-xs sm:text-sm text-[#B6AFA3]">{club.tagline}</p>
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#090908]/90 border border-[#F6F3EC]/10 text-xs font-mono-tech text-[#F6F3EC]">
                                <Clock className="w-3.5 h-3.5 text-[#FF7A33]" />
                                <span>Cierre {club.defaultExpirationHour} hs</span>
                              </div>
                              <span className="font-mono-tech text-xs text-[#D4FF00]">
                                {club.productCount}{' '}
                                {club.productCount === 1 ? 'producto activo' : 'productos activos'}
                              </span>
                            </div>
                          </div>

                          {/* Categorías reales del establecimiento */}
                          {club.categories.length > 0 && (
                            <div className="relative z-10 flex flex-wrap items-center gap-1.5 mt-5 pt-4 border-t border-[#F6F3EC]/10">
                              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#706B62] mr-1">
                                En carta:
                              </span>
                              {club.categories.map((cat) => (
                                <span
                                  key={cat}
                                  className="px-2.5 py-0.5 rounded-md bg-[#090908]/75 border border-[#F6F3EC]/10 text-[11px] text-[#F6F3EC]/90"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Vista previa de bebidas reales de la carta del local */}
                        <div className="p-6 sm:p-8 space-y-5 flex-1 flex flex-col justify-between">
                          {club.featuredProducts.length > 0 ? (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-[11px] font-mono-tech text-[#B6AFA3] uppercase tracking-wider">
                                <span>Adelanto de la carta en vivo</span>
                                <span>Precios oficiales</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {club.featuredProducts.slice(0, 4).map((prod) => (
                                  <Link
                                    key={prod.id}
                                    href={`/${club.slug}`}
                                    className="p-3 rounded-xl bg-[#0C0B0A] hover:bg-[#191715] border border-[#F6F3EC]/8 hover:border-[#D4FF00]/40 flex items-center justify-between gap-2 transition-colors"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-[#F6F3EC] truncate">
                                        {prod.name}
                                      </p>
                                      <span className="text-[10px] text-[#706B62] block">
                                        {prod.category}
                                        {prod.redeemDeadlineTime
                                          ? ` • Promo hasta ${prod.redeemDeadlineTime}`
                                          : ''}
                                      </span>
                                    </div>
                                    <span className="font-mono-tech text-xs font-extrabold text-[#D4FF00] shrink-0">
                                      ${prod.price.toLocaleString('es-AR')}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 rounded-2xl bg-[#0C0B0A] border border-[#F6F3EC]/8 text-xs text-[#B6AFA3]">
                              El local está preparando los productos de su carta para esta noche. Podés entrar a su perfil para ver las novedades o consultar tus QRs.
                            </div>
                          )}

                          {/* Acciones Directas hacia el Establecimiento */}
                          <div className="pt-4 border-t border-[#F6F3EC]/10 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/${club.slug}`}
                                className="min-h-[46px] px-6 py-3 rounded-xl bg-[#D4FF00] hover:bg-[#e1ff33] text-[#050506] font-display-syne font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 transition-all active:scale-95"
                              >
                                <QrCode className="w-4 h-4" />
                                <span>Entrar a la carta de {club.displayName}</span>
                                <ArrowRight className="w-4 h-4" />
                              </Link>

                              <Link
                                href={`/${club.slug}/mis-tragos`}
                                className="min-h-[46px] px-4 py-3 rounded-xl bg-[#1B1917] hover:bg-[#24211E] border border-[#F6F3EC]/12 text-[#F6F3EC] font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
                              >
                                <span>Mis QRs acá</span>
                              </Link>
                            </div>

                            {/* Accesos discretos para personal autorizado del local */}
                            {(club.canAccessBarra || club.canAccessAdmin) && (
                              <div className="flex items-center gap-1.5">
                                {club.canAccessBarra && (
                                  <Link
                                    href={`/${club.slug}/barra`}
                                    className="p-2.5 rounded-xl bg-[#1B1917] hover:bg-[#262320] border border-[#F6F3EC]/15 text-[#FF7A33]"
                                    title="Escáner Barra Bartender"
                                  >
                                    <Wine className="w-4 h-4" />
                                  </Link>
                                )}
                                {club.canAccessAdmin && (
                                  <Link
                                    href={`/${club.slug}/admin`}
                                    className="p-2.5 rounded-xl bg-[#1B1917] hover:bg-[#262320] border border-[#F6F3EC]/15 text-[#D4FF00]"
                                    title="Administración del Local"
                                  >
                                    <Settings className="w-4 h-4" />
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>

                {/* Nota honesta y alternativa cuando hay pocos locales adheridos */}
                {clubs.length <= 2 && (
                  <div className="rounded-2xl bg-[#12110F] border border-[#F6F3EC]/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#B6AFA3]">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-[#FF5500] shrink-0" />
                      <span>
                        Mostramos únicamente los establecimientos con barra digital activa en este momento. ¿Aún no estás en el boliche? Probá el recorrido interactivo abajo.
                      </span>
                    </div>
                    <a
                      href="#demo-interactiva"
                      className="font-mono-tech text-[#D4FF00] font-bold hover:underline shrink-0"
                    >
                      Probar simulador de compra →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ================= D. HISTORIA VISUAL DE 4 MOMENTOS ================= */}
        <VisualStoryTimeline primaryClub={primaryClub} onFocusSearch={focusClubFinder} />

        {/* ================= E. SIMULADOR INTERACTIVO EN CELULAR ================= */}
        <InteractiveMobileDemo clubs={clubs} />

        {/* ================= F. BENEFICIOS EXPLICADOS PARA EL CLIENTE ================= */}
        <section
          id="beneficios-noche"
          aria-labelledby="benefits-heading"
          className="relative py-20 sm:py-28 border-t border-[#F6F3EC]/10 bg-[#080809]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
            {/* Encabezado Editorial */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              <div className="lg:col-span-7">
                <span className="font-mono-tech text-xs uppercase tracking-[0.18em] text-[#D4FF00] block mb-3">
                  [ PENSADO PARA LA NOCHE REAL ]
                </span>
                <h2
                  id="benefits-heading"
                  className="font-display-syne text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F6F3EC] leading-[1.04]"
                >
                  Todo lo que molesta en la barra,{' '}
                  <span className="font-serif-editorial italic font-normal text-[#FF7A33]">
                    resuelto antes de llegar.
                  </span>
                </h2>
              </div>
              <div className="lg:col-span-5">
                <p className="text-sm sm:text-base text-[#B6AFA3] leading-relaxed">
                  Adentro del boliche la música está fuerte, la señal de internet suele fallar y nadie quiere perder media hora empujando para pagar en caja.
                </p>
              </div>
            </div>

            {/* Composición Fotográfica + Situaciones Reales */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Bloque Fotográfico 1: Amigos en la pista */}
              <div className="lg:col-span-7 rounded-3xl overflow-hidden border border-[#F6F3EC]/12 bg-[#121110] relative min-h-[340px] flex flex-col justify-end p-6 sm:p-8">
                <Image
                  src="/editorial/friends-night.jpg"
                  alt="Grupo de amigos disfrutando la noche con sus tragos"
                  fill
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/65 to-transparent" />
                <div className="relative z-10 max-w-lg space-y-2">
                  <span className="font-mono-tech text-[11px] uppercase tracking-widest text-[#D4FF00]">
                    01 / MÁS TIEMPO CON TU GRUPO
                  </span>
                  <h3 className="font-display-syne text-2xl sm:text-3xl font-extrabold text-[#F6F3EC]">
                    Armás el pedido desde la pista o la mesa con tus amigos.
                  </h3>
                  <p className="text-xs sm:text-sm text-[#B6AFA3] leading-relaxed">
                    En lugar de hacer una fila para pagar en caja y otra fila para retirar en la barra, elegís desde el celular y te acercás directo con tu comprobante listo.
                  </p>
                </div>
              </div>

              {/* Bloque Situación 2: Funciona sin señal */}
              <div className="lg:col-span-5 rounded-3xl bg-[#131210] border border-[#F6F3EC]/12 p-6 sm:p-8 flex flex-col justify-between gap-6">
                <div className="w-12 h-12 rounded-2xl bg-[#D4FF00]/15 border border-[#D4FF00]/30 text-[#D4FF00] flex items-center justify-center">
                  <WifiOff className="w-6 h-6" />
                </div>
                <div className="space-y-3">
                  <span className="font-mono-tech text-[11px] uppercase tracking-widest text-[#FF7A33]">
                    02 / SIN SEÑAL ADENTRO DEL BOLICHE
                  </span>
                  <h3 className="font-display-syne text-2xl font-extrabold text-[#F6F3EC]">
                    ¿Se cortó el 4G? Tu QR ya está en la galería de Fotos.
                  </h3>
                  <p className="text-xs sm:text-sm text-[#B6AFA3] leading-relaxed">
                    Apenas se confirma tu compra, BarraOnline descarga una imagen de alta nitidez en tu teléfono y guarda el ticket en tu navegador. En la barra abrís tu galería y lo escanean sin necesitar internet.
                  </p>
                </div>
                <div className="pt-4 border-t border-[#F6F3EC]/10 font-mono-tech text-[11px] text-[#706B62]">
                  DESCARGA AUTOMÁTICA EN PNG • ALTO CONTRASTE
                </div>
              </div>

              {/* Bloque Situación 3: Retiro parcial con el mismo QR */}
              <div className="lg:col-span-4 rounded-3xl bg-[#131210] border border-[#F6F3EC]/12 p-6 sm:p-8 flex flex-col justify-between gap-5">
                <div className="w-12 h-12 rounded-2xl bg-[#FF5500]/15 border border-[#FF5500]/30 text-[#FF7A33] flex items-center justify-center">
                  <QrCode className="w-6 h-6" />
                </div>
                <div className="space-y-2.5">
                  <span className="font-mono-tech text-[11px] uppercase tracking-widest text-[#D4FF00]">
                    03 / UN SOLO QR TODA LA NOCHE
                  </span>
                  <h3 className="font-display-syne text-xl font-extrabold text-[#F6F3EC]">
                    Comprá varios tragos y retiralos de a uno cuando quieras.
                  </h3>
                  <p className="text-xs sm:text-sm text-[#B6AFA3] leading-relaxed">
                    No tenés que cargar cuatro vasos al mismo tiempo ni tomarlos calientes. Tu código QR mantiene tu saldo disponible y descuenta únicamente lo que retirás en cada visita a la barra.
                  </p>
                </div>
              </div>

              {/* Bloque Situación 4: Precios y promos claros */}
              <div className="lg:col-span-4 rounded-3xl bg-[#131210] border border-[#F6F3EC]/12 p-6 sm:p-8 flex flex-col justify-between gap-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="space-y-2.5">
                  <span className="font-mono-tech text-[11px] uppercase tracking-widest text-emerald-400">
                    04 / CLARIDAD ANTES DE PEDIR
                  </span>
                  <h3 className="font-display-syne text-xl font-extrabold text-[#F6F3EC]">
                    Toda la carta, precios y horarios de promo en tu pantalla.
                  </h3>
                  <p className="text-xs sm:text-sm text-[#B6AFA3] leading-relaxed">
                    Consultás cuánto cuesta cada bebida, qué incluye cada combo y hasta qué hora aplican las promociones antes de pagar con Mercado Pago.
                  </p>
                </div>
              </div>

              {/* Bloque Situación 5: Respaldo por DNI */}
              <div className="lg:col-span-4 rounded-3xl bg-[#131210] border border-[#F6F3EC]/12 p-6 sm:p-8 flex flex-col justify-between gap-5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center">
                  <IdCard className="w-6 h-6" />
                </div>
                <div className="space-y-2.5">
                  <span className="font-mono-tech text-[11px] uppercase tracking-widest text-amber-300">
                    05 / RESPALDO POR DOCUMENTO
                  </span>
                  <h3 className="font-display-syne text-xl font-extrabold text-[#F6F3EC]">
                    ¿Te quedaste sin batería a mitad de la noche?
                  </h3>
                  <p className="text-xs sm:text-sm text-[#B6AFA3] leading-relaxed">
                    Tus pedidos quedan asociados a tu número de DNI para que el personal de barra pueda verificar tus compras activas en el sistema del local.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= G. CIERRE NOCTURNO QUE INVITA A ACTUAR ================= */}
        <section
          aria-labelledby="closing-heading"
          className="relative py-20 sm:py-28 border-t border-[#F6F3EC]/12 bg-[#050506] overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-[2.25rem] overflow-hidden border border-[#F6F3EC]/15 bg-[#12110F] p-8 sm:p-14 lg:p-16">
              <Image
                src="/editorial/craft-cocktail.jpg"
                alt="Tragos listos en la barra"
                fill
                sizes="100vw"
                className="object-cover opacity-25"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#050506] via-[#050506]/90 to-[#050506]/65" />

              <div className="relative z-10 max-w-2xl space-y-6">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4FF00]/15 border border-[#D4FF00]/40 text-[#D4FF00] font-mono-tech text-xs uppercase tracking-widest">
                  <span>¿DÓNDE SALÍS ESTA NOCHE?</span>
                </span>

                <h2
                  id="closing-heading"
                  className="font-display-syne text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#F6F3EC] tracking-tight leading-[0.98]"
                >
                  Tu próximo trago{' '}
                  <span className="font-serif-editorial italic font-normal text-[#D4FF00]">
                    está a un QR.
                  </span>
                </h2>

                <p className="text-sm sm:text-lg text-[#B6AFA3] leading-relaxed">
                  Entrá al boliche donde estás, elegí tu bebida desde el celular y acercate a la barra únicamente para retirar.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                  {primaryClub ? (
                    <Link
                      href={`/${primaryClub.slug}`}
                      className="min-h-[54px] px-7 py-4 rounded-2xl bg-[#D4FF00] hover:bg-[#e1ff33] text-[#050506] font-display-syne font-extrabold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 transition-all"
                    >
                      <span>Abrir carta de {primaryClub.displayName}</span>
                      <ArrowUpRight className="w-5 h-5" />
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    onClick={focusClubFinder}
                    className="min-h-[54px] px-6 py-4 rounded-2xl bg-[#191715] hover:bg-[#22201C] border border-[#F6F3EC]/15 text-[#F6F3EC] font-bold text-sm inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-[#FF7A33]" />
                    <span>Buscar un establecimiento</span>
                  </button>

                  <Link
                    href="/mi-cuenta"
                    className="min-h-[54px] px-6 py-4 rounded-2xl bg-transparent hover:bg-[#F6F3EC]/5 border border-[#F6F3EC]/12 text-[#B6AFA3] hover:text-[#F6F3EC] font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Mi Cuenta y compras</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================= PIE DE PÁGINA EDITORIAL ================= */}
      <footer className="border-t border-[#F6F3EC]/10 bg-[#050506] py-10 px-4 sm:px-6 lg:px-8 text-xs text-[#706B62]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="font-display-syne font-extrabold text-base text-[#F6F3EC]">
                BARRA<span className="font-serif-editorial italic font-normal text-[#D4FF00] ml-0.5">online</span>
              </span>
              <span className="text-[#706B62]">•</span>
              <span className="font-mono-tech text-[11px] text-[#B6AFA3]">
                Menos fila. Más noche.
              </span>
            </div>
            <p className="text-[11px] text-[#706B62]">
              Beber con moderación. Prohibida la venta de bebidas alcohólicas a menores de 18 años.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-[#B6AFA3]">
            <button
              type="button"
              onClick={focusClubFinder}
              className="hover:text-[#D4FF00] transition-colors cursor-pointer"
            >
              Buscar boliche
            </button>
            {primaryClub && (
              <>
                <Link
                  href={`/${primaryClub.slug}`}
                  className="hover:text-[#D4FF00] transition-colors"
                >
                  Carta de {primaryClub.displayName}
                </Link>
                <Link
                  href={`/${primaryClub.slug}/mis-tragos`}
                  className="hover:text-[#D4FF00] transition-colors"
                >
                  Mis QRs
                </Link>
              </>
            )}
            <Link href="/mi-cuenta" className="hover:text-[#D4FF00] transition-colors">
              Mi Cuenta
            </Link>

            {canAccessSuperAdmin && (
              <Link
                href="/superadmin"
                className="text-cyan-400 hover:text-cyan-300 font-mono-tech transition-colors"
              >
                SuperAdmin
              </Link>
            )}
          </div>
        </div>
      </footer>

      {/* Barra Inferior Táctil Móvil (Uso con una sola mano) */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0B0A09]/95 backdrop-blur-xl border-t border-[#F6F3EC]/15 px-3 py-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={focusClubFinder}
          className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#181614] border border-[#F6F3EC]/12 text-[#F6F3EC] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <Search className="w-3.5 h-3.5 text-[#D4FF00]" />
          <span>Buscar local</span>
        </button>

        {primaryClub ? (
          <Link
            href={`/${primaryClub.slug}`}
            className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#D4FF00] text-[#050506] font-display-syne font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="truncate">Carta {primaryClub.displayName}</span>
          </Link>
        ) : (
          <a
            href="#demo-interactiva"
            className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#D4FF00] text-[#050506] font-display-syne font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Probar Carta</span>
          </a>
        )}
      </div>

      {/* Modal de Autenticación y Cuenta del Cliente */}
      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(profile) => setCustomer(profile)}
        tenantSlug={primaryClub?.slug || 'demo-club'}
      />
    </div>
  )
}
