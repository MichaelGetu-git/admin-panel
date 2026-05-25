import { notFound } from 'next/navigation'
import { EntityListPage } from '@/components/admin/entity-list-page'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { canReadEntity } from '@/lib/admin-permissions'
import { requireAdminUser } from '@/lib/server/auth'

export default async function Page() {
  const entity = getEntityConfig("categories")
  const adminUser = await requireAdminUser()

  if (!canReadEntity(adminUser.role, entity)) {
    notFound()
  }

  return <EntityListPage adminRole={adminUser.role} entity={entity} />
}
