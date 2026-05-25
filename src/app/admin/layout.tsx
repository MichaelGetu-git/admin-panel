import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { AuthError, requireAdminUser } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let adminUser

  try {
    adminUser = await requireAdminUser()
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) {
      redirect('/login')
    }
    throw error
  }

  return <AdminShell adminRole={adminUser.role}>{children}</AdminShell>
}
