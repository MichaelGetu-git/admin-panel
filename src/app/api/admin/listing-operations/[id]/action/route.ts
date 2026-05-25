import { NextResponse } from 'next/server'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'
import { runListingOperationAction } from '@/lib/server/listing-operations'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('operations.write')
    const body = await readJsonObject(request)
    const action = typeof body.action === 'string' ? body.action.trim() : ''

    if (!action) {
      throw new HttpError('Listing operation action is required.', 400)
    }

    const { id } = await params
    const result = await runListingOperationAction(id, action, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
