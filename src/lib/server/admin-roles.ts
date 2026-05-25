import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import {
  adminRoleOptions,
  AuthError,
  type AdminRole,
  type AdminSessionUser,
} from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from './firebase-admin'
import { HttpError } from './http'

const adminUsersCollection = 'admin_users'
const usersCollection = 'users'
const maxListedAuthUsers = 1000

export interface AdminRoleEntry {
  createdAt?: string
  disabled: boolean
  displayName: string
  email: string
  emailVerified: boolean
  lastSignInAt?: string
  role: AdminRole
  source: string
  uid: string
  updatedAt?: string
}

export async function listAdminUsers(): Promise<AdminRoleEntry[]> {
  const auth = getFirebaseAdminAuth()
  const db = getFirebaseAdminFirestore()
  const authUsers = (await auth.listUsers(maxListedAuthUsers)).users
  const userDocs =
    authUsers.length > 0
      ? await db.getAll(...authUsers.map(user => db.collection(usersCollection).doc(user.uid)))
      : []
  const entries = new Map<string, AdminRoleEntry>()

  authUsers.forEach((user, index) => {
    const userData = userDocs[index]?.data()
    const claimRole = resolveClaimsRole(user.customClaims)
    const userDocRole = resolveUserDocRole(userData)
    const role = claimRole ?? userDocRole

    if (!role) {
      return
    }

    entries.set(user.uid, {
      createdAt: user.metadata.creationTime,
      disabled: user.disabled,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      emailVerified: user.emailVerified,
      lastSignInAt: user.metadata.lastSignInTime,
      role,
      source: claimRole ? 'custom_claims' : 'users',
      uid: user.uid,
      updatedAt: parseDate(userData?.updatedAt),
    })
  })

  const adminRecords = await db.collection(adminUsersCollection).limit(200).get()

  for (const record of adminRecords.docs) {
    if (entries.has(record.id)) {
      continue
    }

    const data = record.data()
    const role = readAdminRole(data.role)

    if (!role) {
      continue
    }

    const user = await auth.getUser(record.id).catch(() => null)

    entries.set(record.id, {
      createdAt: user?.metadata.creationTime,
      disabled: user?.disabled ?? false,
      displayName: user?.displayName ?? readString(data.displayName),
      email: user?.email ?? readString(data.email),
      emailVerified: user?.emailVerified ?? false,
      lastSignInAt: user?.metadata.lastSignInTime,
      role,
      source: 'admin_users',
      uid: record.id,
      updatedAt: parseDate(data.updatedAt),
    })
  }

  return [...entries.values()].sort((left, right) => {
    const leftKey = left.email || left.uid
    const rightKey = right.email || right.uid
    return leftKey.localeCompare(rightKey)
  })
}

export async function addAdminUserByEmail(
  email: string,
  role: AdminRole,
  actor: AdminSessionUser,
) {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail) {
    throw new HttpError('Admin email is required.', 400)
  }

  const user = await getFirebaseAdminAuth()
    .getUserByEmail(normalizedEmail)
    .catch(() => null)

  if (!user) {
    throw new HttpError('No Firebase Auth user exists for this email.', 404)
  }

  return setAdminUserRole(user.uid, role, actor)
}

export async function updateAdminUserRole(
  uid: string,
  role: AdminRole,
  actor: AdminSessionUser,
) {
  if (actor.uid === uid && role !== 'owner') {
    throw new AuthError('Owners cannot demote their own admin role.', 400)
  }

  return setAdminUserRole(uid, role, actor)
}

export async function removeAdminUserRole(uid: string, actor: AdminSessionUser) {
  if (actor.uid === uid) {
    throw new AuthError('Owners cannot remove their own admin access.', 400)
  }

  const auth = getFirebaseAdminAuth()
  const db = getFirebaseAdminFirestore()
  const user = await auth.getUser(uid)
  const customClaims = { ...(user.customClaims ?? {}) }
  delete customClaims.admin
  delete customClaims.isAdmin
  delete customClaims.adminRole
  await auth.setCustomUserClaims(uid, customClaims)

  const userRef = db.collection(usersCollection).doc(uid)
  const userDoc = await userRef.get()

  if (userDoc.exists) {
    const userData = userDoc.data()
    const updateData: Record<string, unknown> = {
      admin: false,
      adminRole: FieldValue.delete(),
      isAdmin: false,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (userData?.role === 'admin') {
      updateData.role = FieldValue.delete()
    }

    await userRef.set(updateData, { merge: true })
  }

  await db.collection(adminUsersCollection).doc(uid).delete()
  await writeAuditLog({
    action: 'admin_roles.remove',
    actor,
    metadata: {
      email: user.email ?? '',
    },
    resourceId: uid,
    resourcePath: `${adminUsersCollection}/${uid}`,
    resourceType: 'admin_user',
  })

  return { ok: true }
}

export function assertAdminRole(value: unknown): AdminRole {
  const role = readAdminRole(value)

  if (!role) {
    throw new HttpError('Unsupported admin role.', 400)
  }

  return role
}

async function setAdminUserRole(
  uid: string,
  role: AdminRole,
  actor: AdminSessionUser,
): Promise<AdminRoleEntry> {
  const auth = getFirebaseAdminAuth()
  const db = getFirebaseAdminFirestore()
  const user = await auth.getUser(uid)
  const customClaims = {
    ...(user.customClaims ?? {}),
    admin: true,
    adminRole: role,
    isAdmin: true,
  }

  await auth.setCustomUserClaims(uid, customClaims)
  await Promise.all([
    db.collection(usersCollection).doc(uid).set(
      {
        admin: true,
        adminRole: role,
        email: user.email ?? '',
        isAdmin: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
    db.collection(adminUsersCollection).doc(uid).set(
      {
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        role,
        uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      },
      { merge: true },
    ),
  ])
  await writeAuditLog({
    action: 'admin_roles.set',
    actor,
    metadata: {
      email: user.email ?? '',
      role,
    },
    resourceId: uid,
    resourcePath: `${adminUsersCollection}/${uid}`,
    resourceType: 'admin_user',
  })

  return {
    createdAt: user.metadata.creationTime,
    disabled: user.disabled,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    emailVerified: user.emailVerified,
    lastSignInAt: user.metadata.lastSignInTime,
    role,
    source: 'custom_claims',
    uid,
  }
}

function resolveClaimsRole(
  customClaims: Record<string, unknown> | undefined,
): AdminRole | null {
  if (!customClaims?.admin && !customClaims?.isAdmin) {
    return null
  }

  return readAdminRole(customClaims.adminRole ?? customClaims.role) ?? 'operator'
}

function resolveUserDocRole(
  userData: FirebaseFirestore.DocumentData | undefined,
): AdminRole | null {
  const role = readAdminRole(userData?.adminRole ?? userData?.role)

  if (role) {
    return role
  }

  if (userData?.admin === true || userData?.isAdmin === true || userData?.role === 'admin') {
    return 'operator'
  }

  return null
}

function readAdminRole(value: unknown): AdminRole | null {
  return adminRoleOptions.includes(value as AdminRole) ? (value as AdminRole) : null
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function parseDate(value: unknown) {
  if (!value) {
    return undefined
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    return date?.toISOString()
  }

  return typeof value === 'string' ? value : undefined
}
