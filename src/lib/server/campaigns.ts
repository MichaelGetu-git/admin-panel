import 'server-only'

import { adminPanelConfig, type AdminCampaignSegmentConfig } from '@/generated/admin-panel.config'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { HttpError } from './http'

const usersCollection = 'users'
const segmentSampleLimit = 1000
const scheduledCampaignsCollection = 'admin_campaigns'

export interface CampaignSegment {
  count: number
  description: string
  id: string
  label: string
}

export interface ScheduledCampaign {
  channel: 'email' | 'push'
  createdAt?: string
  createdBy?: string
  id: string
  notes: string
  scheduledAt?: string
  segmentId: string
  status: string
  title: string
}

export async function getCampaignSegments(): Promise<CampaignSegment[]> {
  const db = getFirebaseAdminFirestore()
  const [totalUsers, sampledUsers] = await Promise.all([
    getCollectionCount(db.collection(usersCollection)),
    db.collection(usersCollection).limit(segmentSampleLimit).get(),
  ])
  const users = sampledUsers.docs.map(doc => doc.data())

  return adminPanelConfig.segments.map(segment => ({
    count: countSegmentUsers(segment, users, totalUsers),
    description: segment.description,
    id: segment.id,
    label: segment.label,
  }))
}

export async function getScheduledCampaigns(): Promise<ScheduledCampaign[]> {
  const db = getFirebaseAdminFirestore()

  try {
    const snapshot = await db
      .collection(scheduledCampaignsCollection)
      .orderBy('scheduledAt', 'desc')
      .limit(50)
      .get()

    return snapshot.docs.map(doc => serializeScheduledCampaign(doc.id, doc.data()))
  } catch {
    const snapshot = await db.collection(scheduledCampaignsCollection).limit(50).get()
    return snapshot.docs
      .map(doc => serializeScheduledCampaign(doc.id, doc.data()))
      .sort((left, right) => readTime(right.scheduledAt) - readTime(left.scheduledAt))
  }
}

export async function createScheduledCampaign(
  input: {
    channel?: unknown
    notes?: unknown
    scheduledAt?: unknown
    segmentId?: unknown
    title?: unknown
  },
  actor: AdminSessionUser,
) {
  const title = readString(input.title)
  const channel = readString(input.channel)
  const segmentId = readString(input.segmentId)
  const scheduledAt = readString(input.scheduledAt)
  const notes = readString(input.notes)

  if (!title) {
    throw new HttpError('Campaign title is required.', 400)
  }

  if (channel !== 'email' && channel !== 'push') {
    throw new HttpError('Campaign channel must be email or push.', 400)
  }

  if (!segmentId) {
    throw new HttpError('Campaign segment is required.', 400)
  }

  if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
    throw new HttpError('A valid scheduled date is required.', 400)
  }

  if (channel === 'email' && !adminPanelConfig.features.includes('email')) {
    throw new HttpError('Email campaigns are not enabled for this panel.', 400)
  }

  if (channel === 'push' && !adminPanelConfig.features.includes('push')) {
    throw new HttpError('Push campaigns are not enabled for this panel.', 400)
  }

  const now = new Date()
  const payload = {
    channel,
    createdAt: now,
    createdBy: actor.uid,
    notes,
    scheduledAt: new Date(scheduledAt),
    segmentId,
    status: 'scheduled',
    title,
    updatedAt: now,
    updatedBy: actor.uid,
  }
  const ref = await getFirebaseAdminFirestore()
    .collection(scheduledCampaignsCollection)
    .add(payload)

  await writeAuditLog({
    action: 'campaign.schedule',
    actor,
    metadata: {
      channel,
      scheduledAt,
      segmentId,
      title,
    },
    resourceId: ref.id,
    resourcePath: ref.path,
    resourceType: 'campaign',
  })

  return serializeScheduledCampaign(ref.id, payload)
}

function countSegmentUsers(
  segment: AdminCampaignSegmentConfig,
  users: FirebaseFirestore.DocumentData[],
  totalUsers: number,
) {
  const rule = segment.rule

  if (rule.type === 'allUsers') {
    return totalUsers
  }

  if (rule.type === 'newUsers') {
    return users.filter(user => isNewUser(user, rule.days)).length
  }

  if (rule.type === 'inactiveUsers') {
    return users.filter(user => isInactiveUser(user, rule.days)).length
  }

  const roleSet = new Set(rule.roles)
  const fieldCandidates = rule.fieldExistsAny ?? []

  return users.filter(user => {
    const role = readString(user.role).toLowerCase()
    return roleSet.has(role) || fieldCandidates.some(field => Boolean(user[field]))
  }).length
}

async function getCollectionCount(collection: FirebaseFirestore.CollectionReference) {
  try {
    const snapshot = await collection.count().get()
    return snapshot.data().count
  } catch {
    const snapshot = await collection.limit(segmentSampleLimit).get()
    return snapshot.size
  }
}

function isNewUser(user: FirebaseFirestore.DocumentData, days: number) {
  const createdAt = parseDate(user.createdAt)
  if (!createdAt) {
    return false
  }

  return Date.now() - createdAt.getTime() <= days * 24 * 60 * 60 * 1000
}

function isInactiveUser(user: FirebaseFirestore.DocumentData, days: number) {
  const lastActivity =
    parseDate(user.lastOnline) ??
    parseDate(user.lastLogin) ??
    parseDate(user.lastOnlineTimestamp) ??
    parseDate(user.updatedAt)

  if (!lastActivity) {
    return true
  }

  return Date.now() - lastActivity.getTime() > days * 24 * 60 * 60 * 1000
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

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function serializeScheduledCampaign(
  id: string,
  data: FirebaseFirestore.DocumentData,
): ScheduledCampaign {
  return {
    channel: readString(data.channel) === 'push' ? 'push' : 'email',
    createdAt: parseDate(data.createdAt)?.toISOString(),
    createdBy: readString(data.createdBy),
    id,
    notes: readString(data.notes),
    scheduledAt: parseDate(data.scheduledAt)?.toISOString(),
    segmentId: readString(data.segmentId),
    status: readString(data.status) || 'scheduled',
    title: readString(data.title) || 'Untitled campaign',
  }
}

function readTime(value: unknown) {
  return parseDate(value)?.getTime() ?? 0
}
