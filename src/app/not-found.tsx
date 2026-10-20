import Link from 'next/link'
import { AlertTriangle, Home } from 'lucide-react'

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
      </div>
    </div>
  )
}
