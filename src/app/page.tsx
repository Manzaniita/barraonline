import Link from 'next/link'
import { QrCode, Sparkles, ShieldCheck, Zap, ArrowRight, GlassWater } from 'lucide-react'
import { ADMIN_ROLES, STAFF_ROLES, getServerSessionUser, hasRoleAccess } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const user = await getServerSessionUser()
  const targetClub = user?.tenantSlug || 'demo-club'
  const canAccessBarra = hasRoleAccess(user, STAFF_ROLES, targetClub)
  const canAccessClubAdmin = hasRoleAccess(user, ADMIN_ROLES, targetClub)
  const canAccessSuperAdmin = hasRoleAccess(user, ['SUPER_ADMIN'])

  return (
    <div className="min-h-screen bg-[#0a0a0e] text-white flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      {/* Navbar Superior */}
      <nav className="border-b border-white/10 px-6 py-4 bg-black/40 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
              <GlassWater className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-white to-pink-200">
              BarraOnline
            </span>
          </div>

          <Link
            href={`/${targetClub}`}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-md shadow-purple-600/20 active:scale-95 transition-all"
          >
            <span>Ir a la Barra de Tragos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero Principal */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Plataforma SaaS White-Label para Boliches</span>
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

        {/* Botón Principal a Barra de Tragos */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md justify-center">
          <Link
            href={`/${targetClub}`}
            className="w-full sm:w-auto flex-1 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-95 text-white font-bold py-3.5 px-6 rounded-2xl shadow-xl shadow-purple-900/40 flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all"
          >
            <QrCode className="w-4 h-4" />
            <span>Abrir Carta de Tragos</span>
          </Link>
        </div>

        {/* Tarjetas de Beneficios Clave */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 text-left w-full">
          <div className="bg-[#12121a] border border-white/10 rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white mb-1">QR Dinámico Reutilizable</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Mismo código QR con saldo parcial: el cliente puede comprar 4 tragos y retirar de a 1 durante toda la noche.
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

      {/* Footer: los links internos (/barra, /admin, /superadmin) SOLO existen si el rol lo permite */}
      <footer className="border-t border-white/10 py-6 px-4 text-center text-xs text-white/40">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>BarraOnline SaaS • Plataforma Nocturna de Alta Disponibilidad</span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
            <Link href={`/${targetClub}`} className="text-gray-400 hover:text-white transition-colors">
              Carta de Tragos
            </Link>
            {canAccessBarra && (
              <>
                <span className="text-gray-700">•</span>
                <Link
                  href={`/${targetClub}/barra`}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Barra Bartender
                </Link>
              </>
            )}
            {canAccessClubAdmin && (
              <>
                <span className="text-gray-700">•</span>
                <Link
                  href={`/${targetClub}/admin`}
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
