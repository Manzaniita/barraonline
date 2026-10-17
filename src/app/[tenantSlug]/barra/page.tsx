'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { QrScannerView } from '@/components/bar/QrScannerView'
import { DispatchModal } from '@/components/bar/DispatchModal'
import { RollbackBanner } from '@/components/bar/RollbackBanner'
import { DniLookupView } from '@/components/bar/DniLookupView'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { BarVerifiedOrder } from '@/lib/bar-service'
import {
  Camera,
  Search,
  GlassWater,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'

export default function BarraPage() {
  const params = useParams()
  const tenantSlug = typeof params?.tenantSlug === 'string' ? params.tenantSlug : 'demo-club'

  const [activeTab, setActiveTab] = useState<'scanner' | 'dni'>('scanner')
  const [activeOrder, setActiveOrder] = useState<{ order: BarVerifiedOrder; qrToken: string } | null>(null)
  const [lastRedemption, setLastRedemption] = useState<{ logIds: string[]; count: number } | null>(null)
  const [totalDespachadosEstaSesion, setTotalDespachadosEstaSesion] = useState(0)

  const handleOrderDetected = (order: BarVerifiedOrder, qrToken: string) => {
    setActiveOrder({ order, qrToken })
  }

  const handleSuccessRedeem = (redemptionLogIds: string[], deliveredCount: number) => {
    setTotalDespachadosEstaSesion((prev) => prev + deliveredCount)
    setLastRedemption({
      logIds: redemptionLogIds,
      count: deliveredCount,
    })
  }

  const handleRollbackComplete = () => {
    if (lastRedemption) {
      setTotalDespachadosEstaSesion((prev) => Math.max(0, prev - lastRedemption.count))
    }
    setLastRedemption(null)
  }

  return (
    <RoleGuard
      allowedRoles={['BARTENDER', 'CLUB_ADMIN', 'SUPER_ADMIN']}
      sectionTitle="Barra de Despacho"
      tenantSlug={tenantSlug}
    >
      <div className="min-h-screen bg-[#0a0a0e] text-white flex flex-col justify-between selection:bg-purple-500 selection:text-white">
        {/* Banner de Reversión flotante si hubo entrega reciente */}
        {lastRedemption && (
          <RollbackBanner
            redemptionLogIds={lastRedemption.logIds}
            itemsDeliveredCount={lastRedemption.count}
            onRollbackComplete={handleRollbackComplete}
            onDismiss={() => setLastRedemption(null)}
          />
        )}

        {/* Cabecera del Bartender */}
        <header className="sticky top-0 z-30 bg-[#0e0e14]/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
                <GlassWater className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm text-white leading-tight">
                  Barra • {tenantSlug.replace(/-/g, ' ').toUpperCase()}
                </h1>
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Scanner en Vivo</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-white/50 block font-medium">Despachados hoy</span>
                <span className="font-extrabold text-sm text-purple-400 font-mono">
                  {totalDespachadosEstaSesion} tragos
                </span>
              </div>

              <Link
                href={`/${tenantSlug}/mi-cuenta`}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-purple-300"
                title="Mi Cuenta"
              >
                <UserCheck className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </header>

        {/* Selector de Pestañas de Barra */}
        <div className="max-w-md mx-auto w-full px-4 pt-3">
          <div className="grid grid-cols-2 p-1 bg-white/5 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'scanner'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Escanear QR</span>
            </button>

            <button
              onClick={() => setActiveTab('dni')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'dni'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Consulta por DNI</span>
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <main className="flex-1 max-w-md mx-auto w-full p-4 pb-20">
          {activeTab === 'scanner' ? (
            <QrScannerView
              tenantSlug={tenantSlug}
              onOrderDetected={handleOrderDetected}
              paused={Boolean(activeOrder)}
            />
          ) : (
            <DniLookupView tenantSlug={tenantSlug} />
          )}
        </main>

        {/* Modal de Despacho al detectar QR */}
        {activeOrder && (
          <DispatchModal
            order={activeOrder.order}
            qrToken={activeOrder.qrToken}
            tenantSlug={tenantSlug}
            onClose={() => setActiveOrder(null)}
            onSuccessRedeem={handleSuccessRedeem}
          />
        )}

        {/* Footer Barra */}
        <footer className="border-t border-white/10 py-3 px-4 text-center text-xs text-white/40">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Validación Criptográfica Activa</span>
            </span>
            <Link href={`/${tenantSlug}`} className="text-purple-400 hover:underline text-[11px]">
              Ver Tienda Cliente
            </Link>
          </div>
        </footer>
      </div>
    </RoleGuard>
  )
}
