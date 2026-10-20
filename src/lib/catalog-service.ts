import { prisma } from './prisma'

export interface ThemeConfig {
  primaryColor: string
  primaryHover: string
  secondaryColor: string
  backgroundColor: string
  cardBackground: string
  textColor: string
  logoUrl?: string
  bannerUrl?: string
  nightclubName: string
  tagline?: string
  searchPlaceholder?: string
  plan?: string
}

export interface StoreProduct {
  id: string
  name: string
  description?: string | null
  category: string
  price: number
  imageUrl?: string | null
  stockAvailable: number
  redeemDeadlineTime?: string | null // Ej: "02:30"
  isActive: boolean
}

export interface TenantWithCatalog {
  id: string
  slug: string
  name: string
  defaultExpirationHour: string
  themeConfig: ThemeConfig
  products: StoreProduct[]
}

/**
 * Obtiene el tenant activo y su catálogo directamente desde PostgreSQL.
 * Si el boliche fue eliminado, no existe o está suspendido/inactivo, retorna null (404).
 */
export async function getTenantAndCatalog(slug: string): Promise<TenantWithCatalog | null> {
  if (!slug || typeof slug !== 'string') return null

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: slug.trim().toLowerCase() },
      include: {
        products: {
          where: { isActive: true },
          orderBy: [{ category: 'asc' }, { price: 'asc' }],
        },
      },
    })

    if (!tenant || !tenant.isActive || tenant.subscriptionStatus === 'CANCELLED') {
      return null
    }

    const rawTheme = (tenant.themeConfig as Record<string, any> | null) || {}
    const primaryColor = rawTheme.primaryColor || rawTheme.brandColor || '#8b5cf6'
    const secondaryColor = rawTheme.secondaryColor || rawTheme.accentColor || '#ec4899'

    const themeConfig: ThemeConfig = {
      primaryColor,
      primaryHover: rawTheme.primaryHover || primaryColor,
      secondaryColor,
      backgroundColor: rawTheme.backgroundColor || '#0a0a0c',
      cardBackground: rawTheme.cardBackground || '#13131a',
      textColor: rawTheme.textColor || '#f8fafc',
      logoUrl: rawTheme.logoUrl || undefined,
      bannerUrl: rawTheme.bannerUrl || undefined,
      nightclubName: rawTheme.nightclubName || tenant.name,
      tagline: rawTheme.tagline !== undefined ? rawTheme.tagline : 'Barra Rápida QR',
      searchPlaceholder:
        rawTheme.searchPlaceholder !== undefined
          ? rawTheme.searchPlaceholder
          : 'Buscar bebida en la carta...',
      plan: rawTheme.plan || 'PRO',
    }

    const products: StoreProduct[] = tenant.products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      price: Number(p.price),
      imageUrl: p.imageUrl,
      stockAvailable: p.stockAvailable,
      redeemDeadlineTime: p.redeemDeadlineTime,
      isActive: p.isActive,
    }))

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      defaultExpirationHour: tenant.defaultExpirationHour || '07:00',
      themeConfig,
      products,
    }
  } catch (error) {
    console.error(`[getTenantAndCatalog] Error consultando tenant '${slug}':`, error)
    return null
  }
}
