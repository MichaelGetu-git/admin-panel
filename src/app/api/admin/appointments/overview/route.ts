import { NextResponse } from 'next/server'
import { getAppointmentOperationsOverview } from '@/lib/server/appointment-operations'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission(['operations.read', 'operations.write'])
    const overview = await getAppointmentOperationsOverview()
    return NextResponse.json({ overview })
  } catch (error) {
    return jsonError(error)
  }
}
