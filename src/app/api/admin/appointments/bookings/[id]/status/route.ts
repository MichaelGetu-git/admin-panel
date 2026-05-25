import { NextResponse } from 'next/server'
import { updateAppointmentBookingStatus } from '@/lib/server/appointment-operations'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('operations.write')
    const body = await readJsonObject(request)
    const status = typeof body.status === 'string' ? body.status.trim() : ''

    if (!status) {
      throw new HttpError('Appointment status is required.', 400)
    }

    const { id } = await params
    const result = await updateAppointmentBookingStatus(id, status, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
