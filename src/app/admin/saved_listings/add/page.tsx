import { notFound } from 'next/navigation'
import { EntityFormPage } from '@/components/admin/entity-form-page'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { canWriteEntity } from '@/lib/admin-permissions'
import { requireAdminUser } from '@/lib/server/auth'

export default async function Page() {
  const entity = getEntityConfig("savedListings")
  const adminUser = await requireAdminUser()

  if (!canWriteEntity(adminUser.role, entity)) {
    notFound()
  }

  return <EntityFormPage adminRole={adminUser.role} entity={entity} mode="create" />
}
