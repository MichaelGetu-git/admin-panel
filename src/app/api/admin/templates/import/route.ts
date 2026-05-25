import { NextResponse } from 'next/server'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { requireAdminUser } from '@/lib/server/auth'
import { importEntitiesCsv } from '@/lib/server/firestore-crud'
import { jsonError } from '@/lib/server/http'

const entity = getEntityConfig("emailTemplates")

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminUser()
    const csv = await request.text()
    const result = await importEntitiesCsv(entity, csv, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
