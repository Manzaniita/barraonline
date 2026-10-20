import { getTenantAndCatalog } from '@/lib/catalog-service'
import { StoreFrontView } from '@/components/store/StoreFrontView'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface TenantPageProps {
  params: Promise<{
    tenantSlug: string
  }>
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { tenantSlug } = await params
  const data = await getTenantAndCatalog(tenantSlug)

  if (!data) {
    return {
      title: 'Tienda no disponible • Barra Online',
    }
  }

  return {
    title: `${data.themeConfig.nightclubName || data.name} • Barra Online QR`,
    description: `Comprá tus tragos online en ${data.themeConfig.nightclubName || data.name} y canjealos al instante en barra con código QR sin hacer colas.`,
  }
}

export default async function TenantPage({ params }: TenantPageProps) {
  const { tenantSlug } = await params
  const tenant = await getTenantAndCatalog(tenantSlug)

  if (!tenant) {
    notFound()
  }

  return <StoreFrontView tenant={tenant} />
}
