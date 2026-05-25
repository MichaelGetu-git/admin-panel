import 'server-only'

import type { AdminEntityConfig } from '@/generated/admin-panel.config'
import {
  canReadEntity,
  canWriteEntity,
  hasAdminPermission,
  hasAnyAdminPermission,
} from '@/lib/admin-permissions'
import { AuthError, requireAdminUser, type AdminSessionUser } from './auth'

export async function requireAdminPermission(
  permission: string | string[],
): Promise<AdminSessionUser> {
  const user = await requireAdminUser()
  assertAdminPermission(user, permission)
  return user
}

export function assertAdminPermission(
  user: AdminSessionUser,
  permission: string | string[],
) {
  const isAllowed = Array.isArray(permission)
    ? hasAnyAdminPermission(user.role, permission)
    : hasAdminPermission(user.role, permission)

  if (!isAllowed) {
    throw new AuthError('Insufficient admin role.', 403)
  }
}

export function assertCanReadEntity(
  user: AdminSessionUser,
  entity: AdminEntityConfig,
) {
  if (!canReadEntity(user.role, entity)) {
    throw new AuthError('Insufficient admin role.', 403)
  }
}

export function assertCanWriteEntity(
  user: AdminSessionUser,
  entity: AdminEntityConfig,
) {
  if (!canWriteEntity(user.role, entity)) {
    throw new AuthError('Insufficient admin role.', 403)
  }
}
