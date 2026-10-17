import React from 'react'
import { redirect } from 'next/navigation'
import { ADMIN_ROLES, getServerSessionUser, hasRoleAccess } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function ClubAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const user = await getServerSessionUser()
  if (!hasRoleAccess(user, ADMIN_ROLES, tenantSlug)) {
    redirect(`/${tenantSlug}`)
  }
  return <>{children}</>
}
