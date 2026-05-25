import { NextResponse } from 'next/server'
import { getCommerceOverview } from '@/lib/server/commerce'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission(['operations.read', 'operations.write'])
    const overview = await getCommerceOverview()
    return NextResponse.json({ overview })
  } catch (error) {
    return jsonError(error)
  }
}
