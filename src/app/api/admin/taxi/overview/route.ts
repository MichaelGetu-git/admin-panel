import { NextResponse } from 'next/server'
import { getTaxiOperationsOverview } from '@/lib/server/taxi-operations'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission(['operations.read', 'operations.write'])
    const overview = await getTaxiOperationsOverview()
    return NextResponse.json({ overview })
  } catch (error) {
    return jsonError(error)
  }
}
