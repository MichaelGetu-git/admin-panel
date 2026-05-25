import { NextResponse } from 'next/server'
import { getListingOperationsOverview } from '@/lib/server/listing-operations'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission(['operations.read', 'operations.write'])
    const overview = await getListingOperationsOverview()
    return NextResponse.json({ overview })
  } catch (error) {
    return jsonError(error)
  }
}
