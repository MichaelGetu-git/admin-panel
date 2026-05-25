import { NextResponse } from 'next/server'
import { getLaunchReadiness } from '@/lib/server/launch-readiness'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission('launch.read')
    const readiness = await getLaunchReadiness()
    return NextResponse.json(readiness)
  } catch (error) {
    return jsonError(error)
  }
}
