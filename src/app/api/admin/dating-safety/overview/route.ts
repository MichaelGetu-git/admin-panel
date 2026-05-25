import { NextResponse } from 'next/server'
import { getDatingSafetyOverview } from '@/lib/server/dating-safety'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission(['moderation.read', 'moderation.write'])
    const overview = await getDatingSafetyOverview()
    return NextResponse.json({ overview })
  } catch (error) {
    return jsonError(error)
  }
}
