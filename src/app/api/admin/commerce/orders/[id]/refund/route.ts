import { NextResponse } from 'next/server'
import { updateCommerceOrderRefundStatus } from '@/lib/server/commerce'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('operations.write')
    const body = await readJsonObject(request)
    const refundStatus = typeof body.refundStatus === 'string' ? body.refundStatus.trim() : ''

    if (!refundStatus) {
      throw new HttpError('Refund status is required.', 400)
    }

    const { id } = await params
    const result = await updateCommerceOrderRefundStatus(id, refundStatus, adminUser)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
