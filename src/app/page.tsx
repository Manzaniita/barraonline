import { ADMIN_ROLES, STAFF_ROLES, getServerSessionUser, hasRoleAccess } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { HomeExperienceClient } from '@/components/home/HomeExperienceClient'
import { HomeClubItem, HomeSessionUser } from '@/components/home/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const [user, rawTenants] = await Promise.all([
    getServerSessionUser(),
    prisma.tenant
      .findMany({
        where: { isActive: true, subscriptionStatus: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          themeConfig: true,
          defaultExpirationHour: true,
          mpAccessTokenEnc: true,
          products: {
            where: { isActive: true },
            orderBy: [{ category: 'asc' }, { price: 'asc' }],
            take: 12,
            select: {
              id: true,
              name: true,
              description: true,
              category: true,
              price: true,
              imageUrl: true,
              stockAvailable: true,
              redeemDeadlineTime: true,
            },
          },
          _count: { select: { products: { where: { isActive: true } } } },
        },
      })
      .catch(() => []),
  ])

  const clubs: HomeClubItem[] = rawTenants.map((t) => {
    const theme = (t.themeConfig as Record<string, unknown> | null) || {}
    const displayName =
      typeof theme.nightclubName === 'string' && theme.nightclubName.trim()
        ? theme.nightclubName.trim()
        : t.name
    const tagline =
      typeof theme.tagline === 'string' && theme.tagline.trim()
        ? theme.tagline.trim()
        : 'Pedí desde el celular y retirá con QR en barra'
    const primaryColor =
      (typeof theme.primaryColor === 'string' && theme.primaryColor) ||
      (typeof theme.brandColor === 'string' && theme.brandColor) ||
      '#FF5500'
    const secondaryColor =
      (typeof theme.secondaryColor === 'string' && theme.secondaryColor) ||
      (typeof theme.accentColor === 'string' && theme.accentColor) ||
      '#F59E0B'
    const logoUrl =
      typeof theme.logoUrl === 'string' && theme.logoUrl.trim() ? theme.logoUrl.trim() : undefined
    const bannerUrl =
      typeof theme.bannerUrl === 'string' && theme.bannerUrl.trim()
        ? theme.bannerUrl.trim()
        : undefined

    const categorySet = new Set<string>()
    for (const p of t.products) {
      if (p.category) categorySet.add(p.category)
    }

    return {
      id: t.id,
      name: t.name,
      displayName,
      slug: t.slug,
      tagline,
      primaryColor,
      secondaryColor,
      logoUrl,
      bannerUrl,
      defaultExpirationHour: t.defaultExpirationHour || '07:00',
      hasMercadoPago: Boolean(t.mpAccessTokenEnc && t.mpAccessTokenEnc.trim().length > 0),
      productCount: t._count.products,
      categories: Array.from(categorySet),
      featuredProducts: t.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        price: Number(p.price),
        imageUrl: p.imageUrl,
        stockAvailable: p.stockAvailable,
        redeemDeadlineTime: p.redeemDeadlineTime,
      })),
      canAccessBarra: hasRoleAccess(user, STAFF_ROLES, t.slug),
      canAccessAdmin: hasRoleAccess(user, ADMIN_ROLES, t.slug),
    }
  })

  const initialUser: HomeSessionUser | null = user
    ? {
        id: user.id,
        fullName: user.fullName ?? null,
        dni: user.dni ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        role: user.role,
        tenantSlug: user.tenantSlug ?? null,
      }
    : null

  const canAccessSuperAdmin = hasRoleAccess(user, ['SUPER_ADMIN'])

  return (
    <HomeExperienceClient
      clubs={clubs}
      initialUser={initialUser}
      canAccessSuperAdmin={canAccessSuperAdmin}
    />
  )
}
