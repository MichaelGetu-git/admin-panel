import 'server-only'

import {
  adminPanelConfig,
  type AdminLaunchChecklistItemConfig,
} from '@/generated/admin-panel.config'
import { getAdminAppSettings } from './app-settings'
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorageBucket,
} from './firebase-admin'

export type LaunchCheckStatus = 'ready' | 'warning' | 'blocked'

export interface LaunchCheck {
  description: string
  href?: string
  id: string
  label: string
  status: LaunchCheckStatus
}

export interface LaunchReadiness {
  blocked: number
  checks: LaunchCheck[]
  ready: number
  score: number
  total: number
  warning: number
}

export async function getLaunchReadiness(): Promise<LaunchReadiness> {
  const [
    settings,
    auditReady,
    contentSeeded,
    storageReady,
    supportReady,
    ownerAdminReady,
  ] = await Promise.all([
    getAdminAppSettings(),
    hasAuditLogEvents(),
    hasStarterContent(),
    canAccessStorage(),
    canAccessSupportUsers(),
    hasOwnerAdmin(),
  ])

  const checks = adminPanelConfig.launchChecklist.map(check =>
    resolveLaunchCheck(check, {
      auditReady,
      contentSeeded,
      ownerAdminReady,
      settingsReady: hasRequiredSettings(settings),
      storageReady,
      supportReady,
    }),
  )

  const ready = checks.filter(check => check.status === 'ready').length
  const warning = checks.filter(check => check.status === 'warning').length
  const blocked = checks.filter(check => check.status === 'blocked').length

  return {
    blocked,
    checks,
    ready,
    score: checks.length > 0 ? Math.round((ready / checks.length) * 100) : 100,
    total: checks.length,
    warning,
  }
}

function resolveLaunchCheck(
  check: AdminLaunchChecklistItemConfig,
  state: {
    auditReady: boolean
    contentSeeded: boolean
    ownerAdminReady: boolean
    settingsReady: boolean
    storageReady: boolean
    supportReady: boolean
  },
): LaunchCheck {
  if (check.feature && !adminPanelConfig.features.includes(check.feature)) {
    return {
      description: check.description,
      href: undefined,
      id: check.id,
      label: check.label,
      status: 'ready',
    }
  }

  if (check.validator === 'requiredEnv') {
    const missing = (check.requiredEnv ?? []).filter(key => !process.env[key])
    const status =
      missing.length === 0
        ? 'ready'
        : check.id === 'firebase-public-config'
          ? 'blocked'
          : 'warning'

    return {
      description:
        missing.length === 0
          ? check.readyDescription ?? check.description
          : `${check.blockedDescription ?? check.warningDescription ?? check.description} Missing: ${missing.join(', ')}.`,
      href: check.href,
      id: check.id,
      label: check.label,
      status,
    }
  }

  if (check.validator === 'firebaseAdminConfig') {
    const ready = hasFirebaseAdminConfig()
    return statusCheck(check, ready, 'warning')
  }

  if (check.validator === 'ownerAdmin') {
    return statusCheck(check, state.ownerAdminReady, 'warning')
  }

  if (check.validator === 'auditLog') {
    return statusCheck(check, state.auditReady, 'warning')
  }

  if (check.validator === 'storage') {
    return statusCheck(check, state.storageReady, 'warning')
  }

  if (check.validator === 'campaignSegments' || check.validator === 'supportCockpit') {
    return statusCheck(check, state.supportReady, 'warning')
  }

  if (check.validator === 'appSettings') {
    return statusCheck(check, state.settingsReady, 'warning')
  }

  if (check.validator === 'starterContent') {
    return statusCheck(check, state.contentSeeded, 'warning')
  }

  return {
    description: check.readyDescription ?? check.description,
    href: check.href,
    id: check.id,
    label: check.label,
    status: 'ready',
  }
}

function statusCheck(
  check: AdminLaunchChecklistItemConfig,
  ready: boolean,
  failureStatus: LaunchCheckStatus,
): LaunchCheck {
  return {
    description: ready
      ? check.readyDescription ?? check.description
      : check.warningDescription ?? check.description,
    href: check.href,
    id: check.id,
    label: check.label,
    status: ready ? 'ready' : failureStatus,
  }
}

function hasFirebaseAdminConfig() {
  const hasServiceAccountPath = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  const hasInlineServiceAccount = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  )
  const hasApplicationDefault = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS)

  return hasServiceAccountPath || hasInlineServiceAccount || hasApplicationDefault
}

async function hasAuditLogEvents() {
  try {
    const snapshot = await getFirebaseAdminFirestore()
      .collection('admin_audit_logs')
      .limit(1)
      .get()
    return !snapshot.empty
  } catch {
    return false
  }
}

function hasRequiredSettings(settings: Awaited<ReturnType<typeof getAdminAppSettings>>) {
  return adminPanelConfig.settings
    .filter(field => field.required)
    .every(field => Boolean(settings[field.key]))
}

async function hasStarterContent() {
  const businessEntities = adminPanelConfig.entities.filter(entity => {
    return (
      entity.access === 'readWrite' &&
      entity.key !== 'users' &&
      entity.key !== 'emailTemplates'
    )
  })

  if (businessEntities.length === 0) {
    return true
  }

  const db = getFirebaseAdminFirestore()

  for (const entity of businessEntities.slice(0, 6)) {
    try {
      const snapshot = await db.collection(entity.collection).limit(1).get()
      if (!snapshot.empty) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

async function canAccessStorage() {
  try {
    await getFirebaseAdminStorageBucket().exists()
    return true
  } catch {
    return false
  }
}

async function canAccessSupportUsers() {
  try {
    await getFirebaseAdminFirestore().collection('users').limit(1).get()
    return true
  } catch {
    return false
  }
}

async function hasOwnerAdmin() {
  try {
    const db = getFirebaseAdminFirestore()
    const [adminUsersOwner, usersOwner, authUsers] = await Promise.all([
      db.collection('admin_users').where('role', '==', 'owner').limit(1).get(),
      db.collection('users').where('adminRole', '==', 'owner').limit(1).get(),
      getFirebaseAdminAuth().listUsers(1000),
    ])

    if (!adminUsersOwner.empty || !usersOwner.empty) {
      return true
    }

    return authUsers.users.some(user => {
      const claims = user.customClaims ?? {}
      return (
        claims.adminRole === 'owner' &&
        (claims.admin === true || claims.isAdmin === true)
      )
    })
  } catch {
    return false
  }
}
