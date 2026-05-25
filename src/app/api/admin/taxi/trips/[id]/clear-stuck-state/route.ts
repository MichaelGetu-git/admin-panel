import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'
import { clearTaxiTripStuckState } from '@/lib/server/taxi-operations'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('operations.write')
    const { id } = await params
    const result = await clearTaxiTripStuckState(id, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
