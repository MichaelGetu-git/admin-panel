import { NextResponse } from 'next/server'
import {
  createScheduledCampaign,
  getScheduledCampaigns,
} from '@/lib/server/campaigns'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission('campaigns.read')
    const campaigns = await getScheduledCampaigns()
    return NextResponse.json({ campaigns })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission('campaigns.write')
    const input = await request.json().catch(() => ({}))
    const campaign = await createScheduledCampaign(input, admin)
    return NextResponse.json({ campaign, success: true })
  } catch (error) {
    return jsonError(error)
  }
}
