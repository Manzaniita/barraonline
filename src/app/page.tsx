import Link from 'next/link'
import { QrCode, Sparkles, ShieldCheck, Zap, ArrowRight, GlassWater, Building2, UserCheck, Settings, Wine } from 'lucide-react'
import { ADMIN_ROLES, STAFF_ROLES, getServerSessionUser, hasRoleAccess } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const [user, activeTenants] = await Promise.all([
    getServerSessionUser(),
    prisma.tenant
      .findMany({
        where: { isActive: true, subscriptionStatus: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          themeConfig: true,
          _count: { select: { products: { where: { isActive: true } } } },
        },
      })
      .catch(() => []),
  ])

  const primaryTenant =
    (user?.tenantSlug && activeTenants.find((t) => t.slug === user.tenantSlug)) ||
    activeTenants[0] ||
    null

  const targetClubSlug = primaryTenant?.slug || null
  const canAccessBarra = targetClubSlug ? hasRoleAccess(user, STAFF_ROLES, targetClubSlug) : false
  const canAccessClubAdmin = targetClubSlug ? hasRoleAccess(user, ADMIN_ROLES, targetClubSlug) : false
  const canAccessSuperAdmin = hasRoleAccess(user, ['SUPER_ADMIN'])

  return (
    <div className="min-h-screen bg-[#0a0a0e] text-white flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      {/* Navbar Superior */}
      <nav className="border-b border-white/10 px-6 py-4 bg-black/40 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
              <GlassWater className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-white to-pink-200">
              BarraOnline
            </span>
          </div>

          <div className="flex items-center gap-2">
            {canAccessSuperAdmin && (
              <Link
                href="/superadmin"
                className="flex items-center gap-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs px-3.5 py-2 rounded-xl transition-all"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SuperAdmin</span>
              </Link>
            )}

            <Link
              href="/mi-cuenta"
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 font-semibold text-xs px-3.5 py-2 rounded-xl transition-all"
            >
              <UserCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>{user ? user.fullName?.split(' ')[0] || 'Mi Cuenta' : 'Mi Cuenta'}</span>
            </Link>

            {targetClubSlug && (
              <Link
                href={`/${targetClubSlug}`}
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-md shadow-purple-600/20 active:scale-95 transition-all"
              >
                <span>Ir a la Tienda</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Principal */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-14 text-center max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Plataforma SaaS White-Label para Boliches y Eventos</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] mb-6">
          Venta de Bebidas y{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400">
            Canje Rápido por QR
          </span>
        </h1>

        <p className="text-base sm:text-lg text-white/70 max-w-xl mb-10 leading-relaxed">
          Eliminá las colas en la barra. Tus clientes compran desde su celular con Mercado Pago, descargan su ticket QR en fotos y retiran sus tragos al instante sin depender de la señal celular.
        </p>

        {/* Listado Dinámico de Boliches / Tiendas Activas */}
        <div className="w-full max-w-2xl mb-12">
          {activeTenants.length > 0 ? (
            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Tiendas / Boliches Activos ({activeTenants.length})</span>
                </span>
                <span className="text-xs text-white/40">Seleccioná un local para abrir su carta</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeTenants.map((t) => {
                  const theme = (t.themeConfig as Record<string, any> | null) || {}
                  const displayName = theme.nightclubName || t.name
                  const tagline = theme.tagline || 'Barra Rápida QR'
                  const brandColor = theme.primaryColor || theme.brandColor || '#8b5cf6'

                  return (
                    <div
                      key={t.id}
                      className="bg-[#12121a] border border-white/10 hover:border-purple-500/40 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-md shrink-0"
                            style={{ backgroundColor: brandColor }}
                          >
                            <GlassWater className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-white truncate">{displayName}</h3>
                            <p className="text-xs text-white/50 truncate">{tagline}</p>
                            <span className="text-[11px] text-purple-400 font-mono">
                              /{t.slug} • {t._count.products} productos
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <Link
                          href={`/${t.slug}`}
                          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Abrir Carta</span>
                        </Link>

                        {hasRoleAccess(user, STAFF_ROLES, t.slug) && (
                          <Link
                            href={`/${t.slug}/barra`}
                            className="p-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300"
                            title="Barra Bartender"
                          >
                            <Wine className="w-4 h-4" />
                          </Link>
                        )}

                        {hasRoleAccess(user, ADMIN_ROLES, t.slug) && (
                          <Link
                            href={`/${t.slug}/admin`}
                            className="p-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300"
                            title="Panel Admin"
                          >
                            <Settings className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[#12121a] border border-white/10 rounded-3xl p-6 text-center space-y-3">
              <Building2 className="w-10 h-10 text-purple-400/60 mx-auto" />
              <h3 className="font-bold text-base text-white">No hay tiendas activas en este momento</h3>
              <p className="text-xs text-white/50 max-w-md mx-auto">
                {canAccessSuperAdmin
                  ? 'Podés dar de alta un nuevo boliche y configurar su carta desde el Panel SuperAdmin.'
                  : 'Próximamente habrá nuevas tiendas y eventos disponibles.'}
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                {canAccessSuperAdmin ? (
                  <Link
                    href="/superadmin"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Ir a SuperAdmin y Crear Boliche</span>
                  </Link>
                ) : (
                  <Link
                    href="/mi-cuenta"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold flex items-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Iniciar Sesión en Mi Cuenta</span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tarjetas de Beneficios Clave */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-left w-full">
          <div className="bg-[#12121a] border border-white/10 rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white mb-1">QR Dinámico Reutilizable</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Mismo código QR con saldo parcial: el cliente puede comprar múltiples tragos y retirar de a 1 durante toda la noche.
            </p>
          </div>

          <div className="bg-[#12121a] border border-white/10 rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center mb-3">
              <QrCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white mb-1">Ticket Offline en Fotos</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Descarga automática a la galería del teléfono para presentar en la barra sin importar si se corta el 4G.
            </p>
          </div>

          <div className="bg-[#12121a] border border-white/10 rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white mb-1">Seguridad Criptográfica</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Firmado digital HMAC-SHA256 inmune a capturas falsas y consulta de DNI estrictamente en modo solo lectura.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 px-4 text-center text-xs text-white/40">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>BarraOnline SaaS • Plataforma Nocturna de Alta Disponibilidad</span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
            {targetClubSlug && (
              <Link href={`/${targetClubSlug}`} className="text-gray-400 hover:text-white transition-colors">
                Carta de Tragos
              </Link>
            )}
            {canAccessBarra && targetClubSlug && (
              <>
                <span className="text-gray-700">•</span>
                <Link
                  href={`/${targetClubSlug}/barra`}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Barra Bartender
                </Link>
              </>
            )}
            {canAccessClubAdmin && targetClubSlug && (
              <>
                <span className="text-gray-700">•</span>
                <Link
                  href={`/${targetClubSlug}/admin`}
                  className="text-pink-400 hover:text-pink-300 transition-colors"
                >
                  Club Admin
                </Link>
              </>
            )}
            {canAccessSuperAdmin && (
              <>
                <span className="text-gray-700">•</span>
                <Link href="/superadmin" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                  SuperAdmin
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
