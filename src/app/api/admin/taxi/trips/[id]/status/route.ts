import { NextResponse } from 'next/server'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'
import { updateTaxiTripStatus } from '@/lib/server/taxi-operations'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('operations.write')
    const body = await readJsonObject(request)
    const status = typeof body.status === 'string' ? body.status.trim() : ''

    if (!status) {
      throw new HttpError('Taxi trip status is required.', 400)
    }

    const { id } = await params
    const result = await updateTaxiTripStatus(id, status, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
