import { notFound } from 'next/navigation'
import { ListingFormPage } from '@/components/admin/listing-form-page'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { canWriteEntity } from '@/lib/admin-permissions'
import { requireAdminUser } from '@/lib/server/auth'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const entity = getEntityConfig("listings")
  const adminUser = await requireAdminUser()

  if (!canWriteEntity(adminUser.role, entity)) {
    notFound()
  }

  const { id } = await params
  return (
    <ListingFormPage
      adminRole={adminUser.role}
      entity={entity}
      mode="update"
      recordId={id}
    />
  )
}
