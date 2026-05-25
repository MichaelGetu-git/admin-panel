import {
  adminPanelConfig,
  type AdminActionConfig,
  type AdminEntityConfig,
} from '@/generated/admin-panel.config'

export function hasAdminPermission(role: string, permission: string) {
  return getRolePermissions(role).some(grantedPermission => {
    return permissionMatches(grantedPermission, permission)
  })
}

export function hasAnyAdminPermission(role: string, permissions: string[]) {
  return permissions.some(permission => hasAdminPermission(role, permission))
}

export function canReadEntity(role: string, entity: AdminEntityConfig) {
  return hasAdminPermission(role, entityPermission(entity, 'read'))
}

export function canWriteEntity(role: string, entity: AdminEntityConfig) {
  return (
    entity.access !== 'readOnly' &&
    hasAdminPermission(role, entityPermission(entity, 'write'))
  )
}

export function canRunEntityWorkflows(role: string, entity: AdminEntityConfig) {
  return adminPanelConfig.workflows
    .filter(workflow => workflow.entity === entity.key || workflow.entity === entity.route)
    .some(workflow =>
      workflow.actions.some(actionId => {
        const action = adminPanelConfig.actions.find(candidate => candidate.id === actionId)
        return Boolean(action && canRunAdminAction(role, entity, action))
      }),
    )
}

export function canRunAdminAction(
  role: string,
  entity: AdminEntityConfig,
  action: AdminActionConfig,
) {
  if (action.type === 'server' && action.serverAction) {
    return hasAdminPermission(role, serverActionPermission(action.serverAction))
  }

  return canWriteEntity(role, entity)
}

export function entityPermission(
  entity: AdminEntityConfig,
  operation: 'read' | 'write',
) {
  return `entities.${entity.key}.${operation}`
}

export function serverActionPermission(
  serverAction: NonNullable<AdminActionConfig['serverAction']>,
) {
  if (
    serverAction === 'commerce.orderStatus' ||
    serverAction === 'commerce.driverAvailability' ||
    serverAction === 'appointments.bookingStatus' ||
    serverAction === 'taxi.clearStuckState' ||
    serverAction === 'taxi.driverAvailability' ||
    serverAction === 'taxi.tripStatus' ||
    serverAction === 'listing.action'
  ) {
    return 'operations.write'
  }

  if (serverAction === 'support.userAction') {
    return 'support.write'
  }

  if (serverAction === 'messaging.action') {
    return 'messaging.write'
  }

  return 'moderation.write'
}

function getRolePermissions(role: string) {
  return adminPanelConfig.rolePermissions[role] ?? []
}

function permissionMatches(
  grantedPermission: string,
  requestedPermission: string,
): boolean {
  if (grantedPermission === '*' || grantedPermission === requestedPermission) {
    return true
  }

  if (
    grantedPermission.endsWith('.*') &&
    requestedPermission.startsWith(grantedPermission.slice(0, -1))
  ) {
    return true
  }

  const requestedParts = requestedPermission.split('.')
  if (requestedParts.length >= 3) {
    const broadPermission = `${requestedParts[0]}.${requestedParts[requestedParts.length - 1]}`
    if (grantedPermission === broadPermission) {
      return true
    }
  }

  if (requestedPermission.endsWith('.read')) {
    return (
      permissionMatches(
        grantedPermission,
        requestedPermission.replace(/\.read$/, '.write'),
      ) ||
      permissionMatches(
        grantedPermission,
        requestedPermission.replace(/\.read$/, '.manage'),
      )
    )
  }

  return false
}
