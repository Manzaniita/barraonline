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
  themeConfig: ThemeConfig
  products: StoreProduct[]
}

// Datos de demostración de alta fidelidad para pruebas inmediatas
export const DEMO_TENANT: TenantWithCatalog = {
  id: 'tenant-demo-club-palermo-01',
  slug: 'demo-club',
  name: 'Club Nocturno Palermo',
  themeConfig: {
    primaryColor: '#8b5cf6', // Violeta neón
    primaryHover: '#7c3aed',
    secondaryColor: '#ec4899', // Rosa neón
    backgroundColor: '#0a0a0c',
    cardBackground: '#13131a',
    textColor: '#f8fafc',
    logoUrl: '/favicon.ico',
    nightclubName: 'Club Nocturno Palermo',
    tagline: 'Barra Rápida QR • Cero Colas',
  },
  products: [
    {
      id: 'prod-fernet-01',
      name: 'Fernet Branca con Coca 750ml',
      description: 'Vaso térmico gigante con hielo cristal y abundante Branca.',
      category: 'Tragos',
      price: 6500,
      stockAvailable: 250,
      isActive: true,
    },
    {
      id: 'prod-gin-tonic-02',
      name: 'Gin Tonic Bombay Sapphire',
      description: 'Ginebra importada, agua tónica premium y rodaja de pepino o limón.',
      category: 'Tragos',
      price: 7500,
      stockAvailable: 180,
      isActive: true,
    },
    {
      id: 'prod-campari-03',
      name: 'Campari Orange',
      description: 'Campari con jugo de naranja natural y rodaja de naranja.',
      category: 'Tragos',
      price: 6000,
      stockAvailable: 120,
      isActive: true,
    },
    {
      id: 'prod-vodka-speed-04',
      name: 'Vodka Smirnoff + Speed',
      description: '⚡ Promo Canje Rápido: retirar antes de las 02:30 AM.',
      category: 'Tragos',
      price: 5500,
      stockAvailable: 90,
      redeemDeadlineTime: '02:30', // Promo con horario
      isActive: true,
    },
    {
      id: 'prod-corona-05',
      name: 'Cerveza Corona 330ml',
      description: 'Porrón helado con gajo de lima.',
      category: 'Cervezas',
      price: 4000,
      stockAvailable: 300,
      isActive: true,
    },
    {
      id: 'prod-patagonia-06',
      name: 'Cerveza Patagonia Amber Lager 710ml',
      description: 'Botella de litro compartible bien fría.',
      category: 'Cervezas',
      price: 5500,
      stockAvailable: 150,
      isActive: true,
    },
    {
      id: 'prod-combo-vodka-07',
      name: 'Combo Absolut + 4 Speed XL',
      description: 'Botella 750ml de Absolut Blue + 4 latas de Speed Unlimited + balde con hielo.',
      category: 'Combos',
      price: 38000,
      stockAvailable: 45,
      isActive: true,
    },
    {
      id: 'prod-combo-jagermeister-08',
      name: 'Combo Jägermeister + 6 Red Bull',
      description: 'Botella 700ml de Jäger + 6 Red Bull + vaso medidor y balde de hielo.',
      category: 'Combos',
      price: 49000,
      stockAvailable: 30,
      isActive: true,
    },
    {
      id: 'prod-agua-09',
      name: 'Agua Mineral Kin con o sin gas 500ml',
      description: 'Hidratación obligatoria para toda la noche.',
      category: 'Sin Alcohol',
      price: 2000,
      stockAvailable: 500,
      isActive: true,
    },
    {
      id: 'prod-redbull-10',
      name: 'Red Bull Energy Drink 250ml',
      description: 'Lata clásica fría.',
      category: 'Sin Alcohol',
      price: 3500,
      stockAvailable: 200,
      isActive: true,
    },
  ],
}

/**
 * Obtiene el tenant y su catálogo activo.
 * Si la base de datos no está inicializada o es el slug de demo,
 * retorna de forma segura los datos de alta fidelidad.
 */
export async function getTenantAndCatalog(slug: string): Promise<TenantWithCatalog | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: {
        products: {
          where: { isActive: true },
          orderBy: [{ category: 'asc' }, { price: 'asc' }],
        },
      },
    })

    if (tenant && tenant.products.length > 0) {
      const defaultTheme: ThemeConfig = {
        primaryColor: '#8b5cf6',
        primaryHover: '#7c3aed',
        secondaryColor: '#ec4899',
        backgroundColor: '#0a0a0c',
        cardBackground: '#13131a',
        textColor: '#f8fafc',
        nightclubName: tenant.name,
      }

      const rawTheme = tenant.themeConfig as Record<string, unknown> | null
      const themeConfig: ThemeConfig = {
        ...defaultTheme,
        ...(rawTheme || {}),
        nightclubName: tenant.name,
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
        themeConfig,
        products,
      }
    }
  } catch (error) {
    console.warn(`[getTenantAndCatalog] Error o base no disponible, usando fallback:`, error)
  }

  // Fallback solo si la base de datos no está disponible o no tiene productos
  if (slug === 'demo-club' || slug === 'palermo-club') {
    return DEMO_TENANT
  }

  return null
}
