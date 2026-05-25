import 'server-only'

import { FieldPath } from 'firebase-admin/firestore'
import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { HttpError } from './http'

const sampleLimit = 500
const datingActions = new Set([
  'delete_report',
  'hide_user',
  'recompute_recommendations',
  'reset_swipe_count',
  'show_user',
  'unblock_pair',
  'unverify_user',
  'verify_user',
])

export interface DatingReportSummary {
  dest: string
  id: string
  source: string
  type: string
  user: string
}

export interface DatingUserSafetySummary {
  email: string
  id: string
  isHidden: boolean
  isVerified: boolean
  issues: string[]
  name: string
  photo: string
  profileScore: number
  recommendations: number
  reports: number
}

export interface DatingSafetyOverview {
  entities: {
    matches?: string
    recommendations?: string
    reports?: string
    subscriptions?: string
    swipeCounts?: string
    swipes?: string
    users?: string
  }
  isEnabled: boolean
  geo: {
    hiddenFromDiscovery: number
    missingLocation: number
    missingPreferences: number
    visibleWithLocation: number
  }
  matches: {
    total: number
    unseen: number
  }
  recommendations: {
    lowInventoryUsers: DatingUserSafetySummary[]
    notComputed: number
    total: number
  }
  reports: {
    pairs: number
    recent: DatingReportSummary[]
    total: number
    types: Array<{ count: number; type: string }>
  }
  subscriptions: {
    active: number
    activeRate: number
    total: number
  }
  swipeCounts: {
    highUsage: Array<{ count: number; id: string }>
    total: number
  }
  swipes: {
    byType: Array<{ count: number; type: string }>
    total: number
  }
  users: {
    hidden: number
    incomplete: number
    missingLocation: number
    missingPhotos: number
    qualityIssues: DatingUserSafetySummary[]
    recent: DatingUserSafetySummary[]
    reported: DatingUserSafetySummary[]
    total: number
  }
  verification: {
    queue: DatingUserSafetySummary[]
    unverified: number
    verified: number
  }
}

export async function getDatingSafetyOverview(): Promise<DatingSafetyOverview> {
  const entities = getDatingEntities()

  if (!isDatingPanel(entities)) {
    return emptyOverview(false, entities)
  }

  const [
    userRows,
    reportRows,
    swipeRows,
    matchRows,
    recommendationRows,
    swipeCountRows,
    subscriptionRows,
    userCount,
    reportCount,
    swipeCount,
    matchCount,
    recommendationCount,
    swipeCounterCount,
    subscriptionCount,
  ] = await Promise.all([
    entities.users ? listEntityRows(entities.users) : Promise.resolve([]),
    entities.reports ? listEntityRows(entities.reports) : Promise.resolve([]),
    entities.swipes ? listEntityRows(entities.swipes) : Promise.resolve([]),
    entities.matches ? listEntityRows(entities.matches) : Promise.resolve([]),
    entities.recommendations ? listEntityRows(entities.recommendations) : Promise.resolve([]),
    entities.swipeCounts ? listEntityRows(entities.swipeCounts) : Promise.resolve([]),
    entities.subscriptions ? listEntityRows(entities.subscriptions) : Promise.resolve([]),
    countEntityDocs(entities.users),
    countEntityDocs(entities.reports),
    countEntityDocs(entities.swipes),
    countEntityDocs(entities.matches),
    countEntityDocs(entities.recommendations),
    countEntityDocs(entities.swipeCounts),
    countEntityDocs(entities.subscriptions),
  ])
  const reportsByUser = countReportsByUser(reportRows)
  const recommendationParentIds = new Set(
    recommendationRows.map(row => readPathParentId(readString(row.id))).filter(Boolean),
  )
  const userSummaries = userRows.map(row => buildUserSummary(row, reportsByUser))

  return {
    entities: serializeDatingEntities(entities),
    geo: {
      hiddenFromDiscovery: userSummaries.filter(user => user.isHidden).length,
      missingLocation: userSummaries.filter(user => user.issues.includes('Missing location')).length,
      missingPreferences: userSummaries.filter(user => user.issues.includes('Missing discovery preferences')).length,
      visibleWithLocation: userSummaries.filter(user =>
        !user.isHidden && !user.issues.includes('Missing location'),
      ).length,
    },
    isEnabled: true,
    matches: {
      total: matchCount,
      unseen: matchRows.filter(row => row.hasBeenSeen === false).length,
    },
    recommendations: {
      lowInventoryUsers: userSummaries
        .filter(user => user.recommendations > -1 && user.recommendations < 5 && !user.isHidden)
        .slice(0, 12),
      notComputed: userRows.filter(row => row.hasComputedRcommendations !== true).length,
      total: recommendationCount,
    },
    reports: {
      pairs: countReportPairs(reportRows),
      recent: reportRows
        .slice()
        .sort((left, right) => readTime(right.createdAt) - readTime(left.createdAt))
        .slice(0, 12)
        .map(buildReportSummary),
      total: reportCount,
      types: countByType(reportRows, row => readString(row.type) || 'unknown'),
    },
    subscriptions: {
      active: subscriptionRows.filter(row => Boolean(row.productId || row.receipt || row.purchaseToken)).length,
      activeRate: percentage(
        subscriptionRows.filter(row => Boolean(row.productId || row.receipt || row.purchaseToken)).length,
        userCount,
      ),
      total: subscriptionCount,
    },
    swipeCounts: {
      highUsage: swipeCountRows
        .map(row => ({ count: readNumber(row.count), id: readString(row.authorID) || readString(row.id) }))
        .filter(row => row.count >= 50)
        .sort((left, right) => right.count - left.count)
        .slice(0, 12),
      total: swipeCounterCount,
    },
    swipes: {
      byType: countByType(swipeRows, row => readString(row.type) || 'unknown'),
      total: swipeCount,
    },
    users: {
      hidden: userSummaries.filter(user => user.isHidden).length,
      incomplete: userSummaries.filter(user => user.profileScore < 100).length,
      missingLocation: userSummaries.filter(user => user.issues.includes('Missing location')).length,
      missingPhotos: userSummaries.filter(user => user.issues.includes('Missing profile photo')).length,
      qualityIssues: userSummaries.filter(user => user.issues.length > 0).slice(0, 12),
      recent: userSummaries.slice(0, 12),
      reported: userSummaries
        .filter(user => user.reports > 0)
        .sort((left, right) => right.reports - left.reports)
        .slice(0, 12),
      total: userCount,
    },
    verification: {
      queue: userSummaries
        .filter(user => !user.isVerified && user.profileScore >= 80 && !user.isHidden)
        .slice(0, 12),
      unverified: userSummaries.filter(user => !user.isVerified).length,
      verified: userSummaries.filter(user => user.isVerified).length,
    },
  }

  function buildUserSummary(row: Record<string, unknown>, reportCounts: Map<string, number>) {
    const id = readString(row.id) || readString(row.userID)
    const settings = readObject(row.settings)
    const issues: string[] = []

    if (!readString(row.firstName)) {
      issues.push('Missing first name')
    }

    if (!readString(row.email) && !readString(row.phone)) {
      issues.push('Missing contact')
    }

    if (!hasMedia(row.profilePictureURL)) {
      issues.push('Missing profile photo')
    }

    if (!hasLocation(row.location)) {
      issues.push('Missing location')
    }

    if (!settings) {
      issues.push('Missing discovery settings')
    }

    if (settings && (!readString(settings.gender) || !readString(settings.gender_preference))) {
      issues.push('Missing discovery preferences')
    }

    if (!readString(row.age)) {
      issues.push('Missing age')
    }

    if (!readString(row.bio)) {
      issues.push('Missing bio')
    }

    const isHidden = row.adminHidden === true || settings?.show_me === false
    if (isHidden) {
      issues.push('Hidden from discovery')
    }

    const recommendations =
      typeof row.currentRecommendationSize === 'number'
        ? row.currentRecommendationSize
        : recommendationParentIds.has(id)
          ? 1
          : -1

    return {
      email: readString(row.email),
      id,
      isHidden,
      isVerified: row.isVerified === true || row.verified === true || readString(row.verificationStatus) === 'verified',
      issues,
      name: [readString(row.firstName), readString(row.lastName)].filter(Boolean).join(' ') ||
        readString(row.email) ||
        'Dating user',
      photo: readString(row.profilePictureURL) || readFirstString(row.photos),
      profileScore: Math.max(0, 100 - issues.filter(issue => issue !== 'Hidden from discovery').length * 20),
      recommendations,
      reports: reportCounts.get(id) ?? 0,
    }
  }
}

export async function runDatingSafetyAction(
  resource: string,
  id: string,
  action: string,
  actor: AdminSessionUser,
) {
  const entities = getDatingEntities()

  if (!isDatingPanel(entities)) {
    throw new HttpError('Dating Safety Center is not enabled for this panel.', 404)
  }

  if (!datingActions.has(action)) {
    throw new HttpError('Unsupported dating safety action.', 400)
  }

  if (resource === 'users') {
    return runUserAction(id, action, actor, entities)
  }

  if (resource === 'reports') {
    return runReportAction(id, action, actor, entities)
  }

  throw new HttpError('Unsupported dating safety resource.', 400)
}

async function runUserAction(
  id: string,
  action: string,
  actor: AdminSessionUser,
  entities: ReturnType<typeof getDatingEntities>,
) {
  if (!entities.users) {
    throw new HttpError('Users are not configured for this panel.', 404)
  }

  const userId = validateTopLevelId(id)
  const db = getFirebaseAdminFirestore()
  const ref = db.collection(entities.users.collection).doc(userId)
  const snapshot = await ref.get()

  if (!snapshot.exists) {
    throw new HttpError('Dating user was not found.', 404)
  }

  const user = snapshot.data() ?? {}
  const settings = readObject(user.settings) ?? {}
  const patch: Record<string, unknown> = {
    adminUpdatedAt: Date.now(),
    adminUpdatedBy: actor.uid,
    updatedAt: Date.now(),
  }
  const metadata: Record<string, unknown> = { action }

  if (action === 'hide_user') {
    patch.adminHidden = true
    patch.adminHiddenAt = Date.now()
    patch.adminHiddenBy = actor.uid
    patch.settings = {
      ...settings,
      show_me: false,
    }
    metadata.purgedRecommendations = await purgeUserRecommendations(userId)
  } else if (action === 'show_user') {
    patch.adminHidden = false
    patch.adminShownAt = Date.now()
    patch.adminShownBy = actor.uid
    patch.hasComputedRcommendations = false
    patch.settings = {
      ...settings,
      show_me: true,
    }
  } else if (action === 'recompute_recommendations') {
    patch.hasComputedRcommendations = false
    patch.currentRecommendationSize = 0
    await db
      .collection('dating_recommendations')
      .doc(userId)
      .set(
        {
          adminRecomputeRequestedAt: Date.now(),
          adminRecomputeRequestedBy: actor.uid,
          isComputingRecommendation: false,
        },
        { merge: true },
      )
  } else if (action === 'reset_swipe_count') {
    if (!entities.swipeCounts) {
      throw new HttpError('Swipe counts are not configured for this panel.', 404)
    }

    await db
      .collection(entities.swipeCounts.collection)
      .doc(userId)
      .set(
        {
          adminResetAt: Date.now(),
          adminResetBy: actor.uid,
          authorID: userId,
          count: 0,
        },
        { merge: true },
      )
    metadata.count = 0
  } else if (action === 'verify_user') {
    patch.isVerified = true
    patch.verified = true
    patch.verificationStatus = 'verified'
    patch.adminVerifiedAt = Date.now()
    patch.adminVerifiedBy = actor.uid
  } else if (action === 'unverify_user') {
    patch.isVerified = false
    patch.verified = false
    patch.verificationStatus = 'unverified'
    patch.adminUnverifiedAt = Date.now()
    patch.adminUnverifiedBy = actor.uid
  } else {
    throw new HttpError('Unsupported user action.', 400)
  }

  await ref.set(patch, { merge: true })
  await writeAuditLog({
    action: `dating_safety.${action}`,
    actor,
    metadata,
    resourceId: userId,
    resourcePath: ref.path,
    resourceType: entities.users.key,
  })

  return {
    ...metadata,
    id: userId,
    success: true,
  }
}

async function runReportAction(
  id: string,
  action: string,
  actor: AdminSessionUser,
  entities: ReturnType<typeof getDatingEntities>,
) {
  if (!entities.reports) {
    throw new HttpError('Reports are not configured for this panel.', 404)
  }

  if (action !== 'delete_report' && action !== 'unblock_pair') {
    throw new HttpError('Unsupported report action.', 400)
  }

  const reportId = validateTopLevelId(id)
  const db = getFirebaseAdminFirestore()
  const ref = db.collection(entities.reports.collection).doc(reportId)
  const snapshot = await ref.get()

  if (!snapshot.exists) {
    throw new HttpError('Dating report was not found.', 404)
  }

  const report = snapshot.data() ?? {}
  const source = readString(report.source)
  const dest = readString(report.dest)
  let deletedReports = 0

  if (action === 'delete_report') {
    await deleteReportRefs(reportId, source, entities.reports.collection)
    deletedReports = 1
  } else {
    if (!source || !dest) {
      throw new HttpError('Report source and destination are required to unblock.', 400)
    }

    const reports = await db
      .collection(entities.reports.collection)
      .where('source', '==', source)
      .where('dest', '==', dest)
      .limit(100)
      .get()

    if (reports.empty) {
      await deleteReportRefs(reportId, source, entities.reports.collection)
      deletedReports = 1
    } else {
      await Promise.all(
        reports.docs.map(doc =>
          deleteReportRefs(doc.id, readString(doc.data().source), entities.reports!.collection),
        ),
      )
      deletedReports = reports.size
    }
  }

  await writeAuditLog({
    action: `dating_safety.${action}`,
    actor,
    metadata: { deletedReports, dest, source },
    resourceId: reportId,
    resourcePath: ref.path,
    resourceType: entities.reports.key,
  })

  return {
    action,
    deletedReports,
    dest,
    id: reportId,
    source,
    success: true,
  }
}

async function deleteReportRefs(
  reportId: string,
  source: string,
  reportCollection: string,
) {
  const db = getFirebaseAdminFirestore()
  const batch = db.batch()

  batch.delete(db.collection(reportCollection).doc(reportId))

  if (source) {
    batch.delete(db.collection(reportCollection).doc(source).collection('reports').doc(reportId))
    batch.delete(db.collection(reportCollection).doc(source).collection('reports_live').doc(reportId))
    batch.delete(db.collection(reportCollection).doc(source).collection('reports_historical').doc(reportId))
  }

  await batch.commit()
}

async function purgeUserRecommendations(userId: string) {
  const db = getFirebaseAdminFirestore()
  const snapshot = await db
    .collection('dating_recommendations')
    .orderBy(FieldPath.documentId())
    .limit(sampleLimit)
    .get()

  if (snapshot.empty) {
    return 0
  }

  const batch = db.batch()
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref.collection('recommendations').doc(userId))
  })
  await batch.commit()

  return snapshot.size
}

function getDatingEntities() {
  return {
    matches: findEntity(['matches']),
    recommendations: findEntity(['recommendations']),
    reports: findEntity(['reports']),
    subscriptions: findEntity(['subscriptions']),
    swipeCounts: findEntity(['swipeCounts', 'swipe-counts']),
    swipes: findEntity(['swipes']),
    users: findEntity(['users']),
  }
}

function isDatingPanel(entities: ReturnType<typeof getDatingEntities>) {
  return adminPanelConfig.mobileApp === 'dating' || Boolean(entities.reports && entities.swipes)
}

async function listEntityRows(entity: AdminEntityConfig, limit = sampleLimit) {
  const db = getFirebaseAdminFirestore()

  if (entity.collectionGroups.length > 0) {
    const snapshots = await Promise.all(
      entity.collectionGroups.map(collectionGroup =>
        db.collectionGroup(collectionGroup).limit(limit).get().catch(() => null),
      ),
    )

    return snapshots
      .flatMap(snapshot => snapshot?.docs ?? [])
      .map(doc => ({
        ...doc.data(),
        _id: doc.id,
        _path: doc.ref.path,
        id: doc.ref.path,
      }) as Record<string, unknown>)
      .slice(0, limit)
  }

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
    db.collection(entity.collection)

  if (entity.orderBy) {
    query = query.orderBy(entity.orderBy.field, entity.orderBy.direction)
  }

  const snapshot = await query.limit(limit).get()
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
  }) as Record<string, unknown>)
}

async function countEntityDocs(entity: AdminEntityConfig | undefined) {
  if (!entity) {
    return 0
  }

  const db = getFirebaseAdminFirestore()

  if (entity.collectionGroups.length > 0) {
    const snapshots = await Promise.all(
      entity.collectionGroups.map(collectionGroup =>
        db.collectionGroup(collectionGroup).limit(sampleLimit).get().catch(() => null),
      ),
    )
    return snapshots.reduce((sum, snapshot) => sum + (snapshot?.size ?? 0), 0)
  }

  const collection = db.collection(entity.collection)

  try {
    const snapshot = await collection.count().get()
    return snapshot.data().count
  } catch {
    return (await collection.limit(sampleLimit).get()).size
  }
}

function emptyOverview(
  isEnabled: boolean,
  entities: ReturnType<typeof getDatingEntities>,
): DatingSafetyOverview {
  return {
    entities: serializeDatingEntities(entities),
    geo: {
      hiddenFromDiscovery: 0,
      missingLocation: 0,
      missingPreferences: 0,
      visibleWithLocation: 0,
    },
    isEnabled,
    matches: {
      total: 0,
      unseen: 0,
    },
    recommendations: {
      lowInventoryUsers: [],
      notComputed: 0,
      total: 0,
    },
    reports: {
      pairs: 0,
      recent: [],
      total: 0,
      types: [],
    },
    subscriptions: {
      active: 0,
      activeRate: 0,
      total: 0,
    },
    swipeCounts: {
      highUsage: [],
      total: 0,
    },
    swipes: {
      byType: [],
      total: 0,
    },
    users: {
      hidden: 0,
      incomplete: 0,
      missingLocation: 0,
      missingPhotos: 0,
      qualityIssues: [],
      recent: [],
      reported: [],
      total: 0,
    },
    verification: {
      queue: [],
      unverified: 0,
      verified: 0,
    },
  }
}

function serializeDatingEntities(entities: ReturnType<typeof getDatingEntities>) {
  return {
    matches: entities.matches?.route,
    recommendations: entities.recommendations?.route,
    reports: entities.reports?.route,
    subscriptions: entities.subscriptions?.route,
    swipeCounts: entities.swipeCounts?.route,
    swipes: entities.swipes?.route,
    users: entities.users?.route,
  }
}

function buildReportSummary(row: Record<string, unknown>): DatingReportSummary {
  return {
    dest: readString(row.dest),
    id: readString(row.id),
    source: readString(row.source),
    type: readString(row.type) || 'report',
    user: readNestedName(row.user) || readString(row.dest) || 'Reported user',
  }
}

function countReportsByUser(rows: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>()

  rows.forEach(row => {
    const dest = readString(row.dest)

    if (dest) {
      counts.set(dest, (counts.get(dest) ?? 0) + 1)
    }
  })

  return counts
}

function countReportPairs(rows: Array<Record<string, unknown>>) {
  return new Set(
    rows.map(row => `${readString(row.source)}:${readString(row.dest)}`).filter(key => key !== ':'),
  ).size
}

function countByType(
  rows: Array<Record<string, unknown>>,
  readKey: (row: Record<string, unknown>) => string,
) {
  const counts = new Map<string, number>()

  rows.forEach(row => {
    const key = readKey(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })

  return [...counts.entries()]
    .map(([type, count]) => ({ count, type }))
    .sort((left, right) => right.count - left.count)
}

function findEntity(keys: string[]) {
  return adminPanelConfig.entities.find(entity => {
    return keys.includes(entity.key) || keys.includes(entity.route)
  })
}

function validateTopLevelId(id: string) {
  const decoded = decodeURIComponent(id)

  if (!decoded || decoded.includes('/')) {
    throw new HttpError('A top-level document ID is required.', 400)
  }

  return decoded
}

function readPathParentId(path: string) {
  const parts = path.split('/').filter(Boolean)
  return parts.length >= 3 ? parts[parts.length - 3] : ''
}

function hasLocation(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const location = value as Record<string, unknown>
  return readNumber(location.latitude) !== 0 || readNumber(location.longitude) !== 0
}

function hasMedia(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.some((item): boolean => hasMedia(item))
  }

  return Boolean(value)
}

function readObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readNestedName(value: unknown) {
  const firstName = readNestedString(value, 'firstName')
  const lastName = readNestedString(value, 'lastName')
  return [firstName, lastName].filter(Boolean).join(' ') ||
    readNestedString(value, 'email') ||
    readNestedString(value, 'name')
}

function readNestedString(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  return readString((value as Record<string, unknown>)[key])
}

function readFirstString(value: unknown) {
  if (!Array.isArray(value)) {
    return ''
  }

  return value.map(readString).find(Boolean) ?? ''
}

function readString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function readTime(value: unknown) {
  const date = parseDate(value)
  return date?.getTime() ?? 0
}

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return Math.round((value / total) * 1000) / 10
}

function parseDate(value: unknown): Date | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const date = new Date(value < 100000000000 ? value * 1000 : value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    return date && !Number.isNaN(date.getTime()) ? date : null
  }

  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}
