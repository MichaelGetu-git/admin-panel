import { NextResponse } from 'next/server'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { requireAdminUser } from '@/lib/server/auth'
import { deleteEntity, getEntity, updateEntity } from '@/lib/server/firestore-crud'
import { jsonError, readJsonObject } from '@/lib/server/http'

const entity = getEntityConfig("reviews")

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminUser()
    const { id } = await params
    const item = await getEntity(entity, id, adminUser)
    return NextResponse.json({
      entity: entity.key,
      collection: entity.collection,
      id,
      item,
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminUser()
    const { id } = await params
    const body = await readJsonObject(request)
    const result = await updateEntity(entity, id, body, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminUser()
    const { id } = await params
    const result = await deleteEntity(entity, id, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
