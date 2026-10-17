import React from 'react'
import { redirect } from 'next/navigation'
import { STAFF_ROLES, getServerSessionUser, hasRoleAccess } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function BarraLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const user = await getServerSessionUser()
  if (!hasRoleAccess(user, STAFF_ROLES, tenantSlug)) {
    redirect(`/${tenantSlug}`)
  }
  return <>{children}</>
}
