import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from './firebase-admin'
import { HttpError } from './http'

const defaultSearchLimit = 20
const maxSearchLimit = 50
const timelineLimitPerEntity = 5
const userSearchFields = ['email', 'username', 'firstName', 'lastName', 'phone']
const userReferenceFields = [
  'userID',
  'userId',
  'authorID',
  'authorId',
  'senderID',
  'senderId',
  'recipientID',
  'recipientId',
  'customerID',
  'customerId',
  'providerID',
  'providerId',
  'driverID',
  'driverId',
  'vendorID',
  'vendorId',
  'ownerID',
  'ownerId',
]

type SupportAction = 'disable_account' | 'enable_account' | 'reset_badge'

export interface SupportUserSummary {
  badgeCount: number
  disabled: boolean
  displayName: string
  email: string
  id: string
  isActive: boolean
  phone: string
  photoUrl: string
  role: string
}

export interface SupportTimelineEntry {
  createdAt?: string
  entity: string
  id: string
  route: string
  status: string
  title: string
}

export async function searchSupportUsers(searchParams: URLSearchParams) {
  const db = getFirebaseAdminFirestore()
  const limit = clampLimit(searchParams.get('limit'))
  const query = searchParams.get('q')?.trim() ?? ''
  const docsById = new Map<string, FirebaseFirestore.DocumentSnapshot>()

  if (query.length > 0) {
    const directDoc = await db.collection('users').doc(query).get().catch(() => null)
    if (directDoc?.exists) {
      docsById.set(directDoc.id, directDoc)
    }

    const snapshots = await Promise.all(
      userSearchFields.map(field =>
        db
          .collection('users')
          .orderBy(field)
          .startAt(query)
          .endAt(query + '\uf8ff')
          .limit(limit)
          .get()
          .catch(() => null),
      ),
    )

    for (const snapshot of snapshots) {
      for (const doc of snapshot?.docs ?? []) {
        docsById.set(doc.id, doc)
      }
    }
  } else {
    const snapshot = await db
      .collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
      .catch(() => null)

    for (const doc of snapshot?.docs ?? []) {
      docsById.set(doc.id, doc)
    }

    if (docsById.size === 0) {
      const fallbackSnapshot = await db.collection('users').limit(limit).get()
      for (const doc of fallbackSnapshot.docs) {
        docsById.set(doc.id, doc)
      }
    }
  }

  return {
    items: Array.from(docsById.values()).slice(0, limit).map(serializeSupportUser),
  }
}

export async function getSupportUser(userId: string) {
  const id = validateUserId(userId)
  const snapshot = await getFirebaseAdminFirestore().collection('users').doc(id).get()

  if (!snapshot.exists) {
    throw new HttpError('User not found.', 404)
  }

  return {
    timeline: await getUserTimeline(id),
    user: serializeSupportUser(snapshot),
  }
}

export async function applySupportUserAction(
  userId: string,
  action: SupportAction,
  actor: AdminSessionUser,
) {
  const id = validateUserId(userId)
  const userRef = getFirebaseAdminFirestore().collection('users').doc(id)
  const snapshot = await userRef.get()

  if (!snapshot.exists) {
    throw new HttpError('User not found.', 404)
  }

  if (action === 'reset_badge') {
    await userRef.set(
      {
        adminBadgeResetAt: FieldValue.serverTimestamp(),
        adminBadgeResetBy: actor.uid,
        badgeCount: 0,
      },
      { merge: true },
    )
  } else if (action === 'disable_account') {
    await updateAuthDisabledState(id, true)
    await userRef.set(
      {
        active: false,
        adminDisabledAt: FieldValue.serverTimestamp(),
        adminDisabledBy: actor.uid,
        disabled: true,
        isActive: false,
      },
      { merge: true },
    )
  } else if (action === 'enable_account') {
    await updateAuthDisabledState(id, false)
    await userRef.set(
      {
        active: true,
        adminEnabledAt: FieldValue.serverTimestamp(),
        adminEnabledBy: actor.uid,
        disabled: false,
        isActive: true,
      },
      { merge: true },
    )
  } else {
    throw new HttpError('Unsupported support action.', 400)
  }

  await writeAuditLog({
    action: `support.${action}`,
    actor,
    resourceId: id,
    resourcePath: `users/${id}`,
    resourceType: 'user',
  })

  return {
    action,
    success: true,
    user: (await getSupportUser(id)).user,
  }
}

async function getUserTimeline(userId: string): Promise<SupportTimelineEntry[]> {
  const timeline = (
    await Promise.all(
      adminPanelConfig.entities
        .filter(entity => entity.key !== 'users' && entity.collectionGroups.length === 0)
        .map(entity => getEntityTimeline(entity, userId)),
    )
  )
    .flat()
    .sort((left, right) => {
      return dateValue(right.createdAt) - dateValue(left.createdAt)
    })
    .slice(0, 40)

  return timeline
}

async function getEntityTimeline(entity: AdminEntityConfig, userId: string) {
  const fields = userReferenceFields.filter(field => field in entity.fields)
  const arrayFields = ['participants', 'members', 'users'].filter(field => field in entity.fields)
  const snapshots = await Promise.all([
    ...fields.map(field =>
      getFirebaseAdminFirestore()
        .collection(entity.collection)
        .where(field, '==', userId)
        .limit(timelineLimitPerEntity)
        .get()
        .catch(() => null),
    ),
    ...arrayFields.map(field =>
      getFirebaseAdminFirestore()
        .collection(entity.collection)
        .where(field, 'array-contains', userId)
        .limit(timelineLimitPerEntity)
        .get()
        .catch(() => null),
    ),
  ])
  const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()

  for (const snapshot of snapshots) {
    for (const doc of snapshot?.docs ?? []) {
      docsById.set(doc.id, doc)
    }
  }

  return Array.from(docsById.values()).map(doc => {
    const data = doc.data()

    return {
      createdAt: parseDate(data.createdAt ?? data.updatedAt),
      entity: entity.displayName,
      id: doc.id,
      route: entity.route,
      status: readString(
        data.status ??
          data.orderStatus ??
          data.paymentStatus ??
          data.approvalStatus ??
          data.moderationStatus,
      ),
      title: readTitle(data, entity),
    }
  })
}

async function updateAuthDisabledState(userId: string, disabled: boolean) {
  await getFirebaseAdminAuth()
    .updateUser(userId, { disabled })
    .catch(() => undefined)
}

function serializeSupportUser(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
): SupportUserSummary {
  const data = doc.data() ?? {}
  const displayName =
    readString(data.displayName) ||
    [readString(data.firstName), readString(data.lastName)].filter(Boolean).join(' ') ||
    readString(data.username) ||
    readString(data.email) ||
    doc.id

  return {
    badgeCount: readNumber(data.badgeCount),
    disabled: data.disabled === true,
    displayName,
    email: readString(data.email),
    id: doc.id,
    isActive: data.isActive !== false && data.active !== false && data.disabled !== true,
    phone: readString(data.phone),
    photoUrl:
      readString(data.profilePictureURL) ||
      readString(data.profilePictureUrl) ||
      readString(data.photoURL),
    role: readString(data.role) || readString(data.adminRole),
  }
}

function readTitle(data: FirebaseFirestore.DocumentData, entity: AdminEntityConfig) {
  return (
    readString(data[entity.titleField]) ||
    readString(data.title) ||
    readString(data.name) ||
    readString(data.text) ||
    readString(data.content) ||
    'Record'
  )
}

function clampLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultSearchLimit
  }

  return Math.min(parsed, maxSearchLimit)
}

function validateUserId(value: string) {
  const decoded = decodeURIComponent(value)

  if (!decoded || decoded.includes('/')) {
    throw new HttpError('A top-level user ID is required.', 400)
  }

  return decoded
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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

  if (typeof value === 'number') {
    const date = new Date(value < 100000000000 ? value * 1000 : value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }

  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toISOString()
  }

  return undefined
}

function dateValue(value: string | undefined) {
  if (!value) {
    return 0
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
