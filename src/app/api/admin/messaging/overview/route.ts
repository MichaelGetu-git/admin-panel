import { NextResponse } from 'next/server'
import { getMessagingOperationsOverview } from '@/lib/server/messaging-operations'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission(['messaging.read', 'messaging.write'])
    const overview = await getMessagingOperationsOverview()
    return NextResponse.json({ overview })
  } catch (error) {
    return jsonError(error)
  }
}
