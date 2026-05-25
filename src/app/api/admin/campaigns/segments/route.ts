import { NextResponse } from 'next/server'
import { getCampaignSegments } from '@/lib/server/campaigns'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission(['campaigns.read', 'campaigns.write'])
    const segments = await getCampaignSegments()
    return NextResponse.json({ segments })
  } catch (error) {
    return jsonError(error)
  }
}
