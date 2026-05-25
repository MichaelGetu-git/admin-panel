import { NextResponse } from 'next/server'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { requireAdminUser } from '@/lib/server/auth'
import { runEntityWorkflowAction } from '@/lib/server/firestore-crud'
import { jsonError, readJsonObject } from '@/lib/server/http'

const entity = getEntityConfig("categories")

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminUser()
    const { id } = await params
    const body = await readJsonObject(request)
    const result = await runEntityWorkflowAction(entity, id, body, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
