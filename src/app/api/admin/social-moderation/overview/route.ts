import { NextResponse } from 'next/server'
import { getSocialModerationOverview } from '@/lib/server/social-moderation'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission(['moderation.read', 'moderation.write'])
    const overview = await getSocialModerationOverview()
    return NextResponse.json({ overview })
  } catch (error) {
    return jsonError(error)
  }
}
