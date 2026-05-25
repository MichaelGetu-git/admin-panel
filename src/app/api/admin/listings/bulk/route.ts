import { NextResponse } from 'next/server'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { requireAdminUser } from '@/lib/server/auth'
import { bulkEntityAction } from '@/lib/server/firestore-crud'
import { jsonError, readJsonObject } from '@/lib/server/http'

const entity = getEntityConfig("listings")

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminUser()
    const body = await readJsonObject(request)
    const result = await bulkEntityAction(entity, body, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
