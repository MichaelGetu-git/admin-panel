import { NextResponse } from 'next/server'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'
import { assignTaxiTripDriver } from '@/lib/server/taxi-operations'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('operations.write')
    const body = await readJsonObject(request)
    const driverId = typeof body.driverId === 'string' ? body.driverId.trim() : ''

    if (!driverId) {
      throw new HttpError('Driver ID is required.', 400)
    }

    const { id } = await params
    const result = await assignTaxiTripDriver(id, driverId, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
