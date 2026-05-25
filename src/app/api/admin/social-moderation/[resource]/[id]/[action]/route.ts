import { NextResponse } from 'next/server'
import {
  applySocialModerationAction,
  type SocialModerationAction,
} from '@/lib/server/social-moderation'
import { HttpError, jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

interface RouteContext {
  params: Promise<{
    action: string
    id: string
    resource: string
  }>
}

const allowedActions = new Set(['approve', 'delete', 'hide', 'resolve', 'show'])

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminPermission('moderation.write')
    const { action, id, resource } = await params

    if (!allowedActions.has(action)) {
      throw new HttpError('Unsupported social moderation action.', 400)
    }

    const result = await applySocialModerationAction(
      resource,
      id,
      action as SocialModerationAction,
      adminUser,
    )

    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
