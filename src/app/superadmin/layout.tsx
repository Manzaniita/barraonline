import React from 'react'
import { redirect } from 'next/navigation'
import { getServerSessionUser, hasRoleAccess } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser()
  if (!hasRoleAccess(user, ['SUPER_ADMIN'])) {
    redirect(user?.tenantSlug ? `/${user.tenantSlug}` : '/mi-cuenta')
  }
  return <>{children}</>
}
