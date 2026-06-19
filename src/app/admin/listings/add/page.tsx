import { notFound } from 'next/navigation'
import { ListingFormPage } from '@/components/admin/listing-form-page'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { canWriteEntity } from '@/lib/admin-permissions'
import { requireAdminUser } from '@/lib/server/auth'

export default async function Page() {
  const entity = getEntityConfig("listings")
  const adminUser = await requireAdminUser()

  if (!canWriteEntity(adminUser.role, entity)) {
    notFound()
  }

  return <ListingFormPage adminRole={adminUser.role} entity={entity} mode="create" />
}
