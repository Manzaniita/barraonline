import React from 'react'
import { redirect } from 'next/navigation'
import { DEFAULT_TENANT_SLUG, getServerSessionUser, hasRoleAccess } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser()
  if (!hasRoleAccess(user, ['SUPER_ADMIN'])) {
    redirect(`/${user?.tenantSlug || DEFAULT_TENANT_SLUG}`)
  }
  return <>{children}</>
}
