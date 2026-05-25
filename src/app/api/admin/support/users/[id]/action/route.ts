import { NextResponse } from 'next/server'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'
import { applySupportUserAction } from '@/lib/server/support'

interface RouteContext {
  params: Promise<{ id: string }>
}

const allowedActions = new Set([
  'disable_account',
  'enable_account',
  'reset_badge',
])

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('support.write')
    const body = await readJsonObject(request)
    const action = typeof body.action === 'string' ? body.action : ''

    if (!allowedActions.has(action)) {
      throw new HttpError('Unsupported support action.', 400)
    }

    const { id } = await params
    const result = await applySupportUserAction(
      id,
      action as 'disable_account' | 'enable_account' | 'reset_badge',
      adminUser,
    )

    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
