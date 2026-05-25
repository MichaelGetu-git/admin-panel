import { NextResponse } from 'next/server'
import { blockAppointmentAvailabilitySlot } from '@/lib/server/appointment-operations'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdminPermission('operations.write')
    const body = await readJsonObject(request)
    const professionalId =
      typeof body.professionalId === 'string' ? body.professionalId.trim() : ''
    const date = typeof body.date === 'string' ? body.date.trim() : ''
    const time = typeof body.time === 'string' ? body.time.trim() : ''

    if (!professionalId || !date || !time) {
      throw new HttpError('Professional, date and time are required.', 400)
    }

    const result = await blockAppointmentAvailabilitySlot(
      { date, professionalId, time },
      adminUser,
    )
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
