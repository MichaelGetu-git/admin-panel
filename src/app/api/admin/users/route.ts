import { NextResponse } from 'next/server'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { requireAdminUser } from '@/lib/server/auth'
import { createEntity, listEntities } from '@/lib/server/firestore-crud'
import { jsonError, readJsonObject } from '@/lib/server/http'

const entity = getEntityConfig("users")

export async function GET(request: Request) {
  try {
    const adminUser = await requireAdminUser()
    const result = await listEntities(
      entity,
      new URL(request.url).searchParams,
      adminUser,
    )
    return NextResponse.json({
      entity: entity.key,
      collection: entity.collection,
      [entity.pluralName]: result.items,
      items: result.items,
      nextCursor: result.nextCursor,
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminUser()
    const body = await readJsonObject(request)
    const result = await createEntity(entity, body, adminUser)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
