'use client'

import React, { useState } from 'react'
import { Search, ShieldAlert, User, Clock, AlertCircle, Sparkles } from 'lucide-react'

interface DniLookupViewProps {
  tenantSlug: string
}

export function DniLookupView({ tenantSlug }: DniLookupViewProps) {
  const [dni, setDni] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanDni = dni.replace(/\D/g, '')

    if (cleanDni.length < 7) {
      setError('Ingresá un DNI válido de al menos 7 dígitos.')
      return
    }

    setIsSearching(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/bar/lookup-dni?dni=${cleanDni}&tenantSlug=${tenantSlug}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al consultar DNI.')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la búsqueda')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Banner Estricto de Seguridad */}
      <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 text-amber-200 text-xs flex items-start gap-3 shadow-lg">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-extrabold text-sm text-amber-300">
            MODO CONSULTA (ESTRICTO SOLO LECTURA)
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-amber-200/90">
            Esta pantalla solo permite verificar qué compras realizó un cliente y qué saldo le queda disponible. <strong>Está estrictamente prohibido despachar tragos sin escanear el código QR del cliente.</strong>
          </p>
        </div>
      </div>

      {/* Buscador de DNI */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="tel"
            inputMode="numeric"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
            placeholder="Buscar por DNI del cliente..."
            className="w-full bg-obsidian-elevated border border-obsidian-border rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-5 py-3 rounded-2xl text-xs active:scale-95 transition-all shadow-md"
        >
          {isSearching ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Resultados de la Búsqueda */}
      {result && (
        <div className="space-y-3">
          {result.found ? (
            <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">{result.customer.fullName}</h3>
                  <p className="text-xs text-white/50">DNI: {result.customer.dni}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">
                  Historial de Órdenes y Saldos:
                </h4>

                {result.orders.length === 0 ? (
                  <p className="text-xs text-white/40">No tiene compras registradas en este boliche.</p>
                ) : (
                  result.orders.map((o: any) => (
                    <div
                      key={o.orderId}
                      className="bg-black/30 border border-white/5 rounded-2xl p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-purple-400 font-bold">
                          #{o.orderId.slice(0, 8)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : o.status === 'DEPLETED'
                              ? 'bg-white/10 text-white/40'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {o.status === 'ACTIVE' ? 'CON SALDO' : o.status === 'DEPLETED' ? 'AGOTADA' : o.status}
                        </span>
                      </div>

                      <div className="space-y-1 pt-1 border-t border-white/5">
                        {o.items.map((i: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-white/80">{i.name}</span>
                            <span className="text-white/50 font-mono">
                              Disponibles: <strong className="text-emerald-400">{i.remaining}</strong> de {i.purchased}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Botón de Canje BLOQUEADO por regla de negocio */}
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                <p className="text-[11px] font-bold text-red-300">
                  Botón de despacho bloqueado por seguridad
                </p>
                <p className="text-[10px] text-red-200/70 mt-0.5">
                  El cliente debe presentar su QR (desde fotos o su sesión) y ser escaneado con la cámara.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-obsidian-surface border border-obsidian-border rounded-3xl p-8 text-center text-white/50">
              <Sparkles className="w-8 h-8 mx-auto text-purple-400 mb-2 opacity-50" />
              <p className="text-sm font-medium">No se encontraron compras para el DNI {dni}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
