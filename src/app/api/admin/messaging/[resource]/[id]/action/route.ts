import { NextResponse } from 'next/server'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'
import { runMessagingOperationAction } from '@/lib/server/messaging-operations'

interface RouteContext {
  params: Promise<{ id: string; resource: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('messaging.write')
    const body = await readJsonObject(request)
    const action = typeof body.action === 'string' ? body.action.trim() : ''

    if (!action) {
      throw new HttpError('Messaging operation action is required.', 400)
    }

    const { id, resource } = await params
    const result = await runMessagingOperationAction(resource, id, action, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
