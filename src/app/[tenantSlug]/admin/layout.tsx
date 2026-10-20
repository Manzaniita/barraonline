import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { ADMIN_ROLES, getServerSessionUser, hasRoleAccess } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ClubAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  })
  if (!tenant) {
    notFound()
  }

  const user = await getServerSessionUser()
  if (!hasRoleAccess(user, ADMIN_ROLES, tenantSlug)) {
    redirect(`/${tenantSlug}`)
  }
  return <>{children}</>
}
