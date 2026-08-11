import { notFound } from 'next/navigation'
import { UserFormPage } from '@/components/admin/user-form-page'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { canWriteEntity } from '@/lib/admin-permissions'
import { requireAdminUser } from '@/lib/server/auth'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const entity = getEntityConfig("users")
  const adminUser = await requireAdminUser()

  if (!canWriteEntity(adminUser.role, entity)) {
    notFound()
  }

  const { id } = await params
  return (
    <UserFormPage
      adminRole={adminUser.role}
      entity={entity}
      mode="update"
      recordId={id}
    />
  )
}
