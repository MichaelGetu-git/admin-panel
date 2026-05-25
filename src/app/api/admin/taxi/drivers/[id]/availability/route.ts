import { NextResponse } from 'next/server'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'
import { updateTaxiDriverAvailability } from '@/lib/server/taxi-operations'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('operations.write')
    const body = await readJsonObject(request)

    if (typeof body.isActive !== 'boolean') {
      throw new HttpError('Driver availability must be a boolean.', 400)
    }

    const { id } = await params
    const result = await updateTaxiDriverAvailability(id, body.isActive, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
