import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CheckCircle2, Clock, XCircle, ArrowLeft } from 'lucide-react'
import { TicketQRCard } from '@/components/store/TicketQRCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface OrderPageProps {
  params: Promise<{
    tenantSlug: string
    orderId: string
  }>
  searchParams: Promise<{
    status?: string
    demo?: string
  }>
}

export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  const { tenantSlug, orderId } = await params
  const { status, demo } = await searchParams

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      tenant: {
        select: {
          slug: true,
          name: true,
          isActive: true,
          subscriptionStatus: true,
        },
      },
    },
  })

  if (
    !order ||
    !order.tenant ||
    order.tenant.slug !== tenantSlug ||
    !order.tenant.isActive ||
    order.tenant.subscriptionStatus === 'CANCELLED'
  ) {
    notFound()
  }

  const isApproved = status === 'approved' || demo === 'true' || order.status === 'ACTIVE'
  const isPending = status === 'pending' || (!isApproved && order.status === 'PENDING')

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col justify-between p-4 selection:bg-purple-500 selection:text-white">
      <div className="max-w-md mx-auto w-full pt-8 pb-16 flex flex-col items-center text-center">
        {/* Ícono de Estado */}
        {isApproved ? (
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6 shadow-xl shadow-emerald-500/10 animate-in zoom-in duration-300">
            <CheckCircle2 className="w-10 h-10" />
          </div>
        ) : isPending ? (
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6 shadow-xl shadow-amber-500/10">
            <Clock className="w-10 h-10 animate-spin" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-3xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 mb-6 shadow-xl shadow-red-500/10">
            <XCircle className="w-10 h-10" />
          </div>
        )}

        {/* Título y Mensaje */}
        <h1 className="text-2xl font-black tracking-tight mb-2">
          {isApproved
            ? '¡Pago Aprobado!'
            : isPending
            ? 'Procesando Pago...'
            : 'Pago no completado'}
        </h1>

        <p className="text-sm text-white/60 mb-6 leading-relaxed max-w-xs">
          {isApproved
            ? 'Tu pedido ya fue confirmado por Mercado Pago y tus bebidas están listas para ser canjeadas.'
            : isPending
            ? 'Estamos aguardando la confirmación de Mercado Pago. Te notificaremos en segundos.'
            : 'El pago fue rechazado o cancelado. Podés reintentar cuando quieras.'}
        </p>

        {/* Card de Detalles de la Orden */}
        <div className="w-full bg-[#12121a] border border-white/10 rounded-2xl p-5 mb-6 text-left space-y-3">
          <div className="flex items-center justify-between text-xs pb-3 border-b border-white/5">
            <span className="text-white/40">Código de Orden</span>
            <span className="font-mono text-purple-400 font-semibold">{orderId.slice(0, 8)}...</span>
          </div>

          <div className="flex items-center justify-between text-xs pb-3 border-b border-white/5">
            <span className="text-white/40">Boliche</span>
            <span className="font-semibold text-white">{order.tenant.name}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Estado de Orden</span>
            <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
              isApproved
                ? 'bg-emerald-500/20 text-emerald-300'
                : isPending
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-red-500/20 text-red-300'
            }`}>
              {isApproved ? 'ACTIVA / LISTA' : isPending ? 'PENDIENTE' : 'CANCELADA'}
            </span>
          </div>
        </div>

        {/* Ticket QR Oficial de la Orden */}
        {isApproved && (
          <div className="w-full mb-6">
            <TicketQRCard
              orderId={orderId}
              tenantSlug={tenantSlug}
              nightclubName={order.tenant.name}
              demo={demo === 'true'}
            />
          </div>
        )}

        {/* Botones de Navegación */}
        <div className="w-full space-y-3">
          <Link
            href={`/${tenantSlug}`}
            className="w-full bg-white/10 hover:bg-white/15 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a la Carta de Tragos</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
