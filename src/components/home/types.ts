export interface HomeProductPreview {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  imageUrl: string | null
  stockAvailable: number
  redeemDeadlineTime: string | null
}

export interface HomeClubItem {
  id: string
  name: string
  displayName: string
  slug: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  logoUrl?: string
  bannerUrl?: string
  defaultExpirationHour: string
  hasMercadoPago: boolean
  productCount: number
  categories: string[]
  featuredProducts: HomeProductPreview[]
  canAccessBarra: boolean
  canAccessAdmin: boolean
}

export interface HomeSessionUser {
  id: string
  fullName: string | null
  dni: string | null
  email: string | null
  phone: string | null
  role: string
  tenantSlug: string | null
}
