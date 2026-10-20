import Link from 'next/link'
import { AlertTriangle, Home, ShieldCheck, UserCheck } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#07070b] text-white flex flex-col items-center justify-center p-6 text-center selection:bg-purple-500 selection:text-white">
      <div className="w-20 h-20 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-6 shadow-2xl shadow-rose-950/50">
        <AlertTriangle className="w-10 h-10" />
      </div>

      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
        Tienda o Página No Disponible
      </h1>

      <p className="text-sm sm:text-base text-gray-400 max-w-md mb-8 leading-relaxed">
        El boliche o la dirección que estás buscando no existe, fue eliminado o se encuentra temporalmente deshabilitado en la plataforma.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-2 shadow-xl shadow-purple-900/30 transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Ir al Inicio</span>
        </Link>

        <Link
          href="/mi-cuenta"
          className="px-5 py-3 rounded-2xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 text-xs font-semibold flex items-center gap-2 transition-all"
        >
          <UserCheck className="w-4 h-4 text-purple-400" />
          <span>Mi Cuenta</span>
        </Link>

        <Link
          href="/superadmin"
          className="px-5 py-3 rounded-2xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-cyan-300 text-xs font-semibold flex items-center gap-2 transition-all"
        >
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Panel SuperAdmin</span>
        </Link>
      </div>
    </div>
  )
}
