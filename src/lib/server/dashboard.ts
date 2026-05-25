import 'server-only'

import {
  adminPanelConfig,
  type AdminDashboardWidgetConfig,
  type AdminEntityConfig,
} from '@/generated/admin-panel.config'
import { getFirebaseAdminFirestore } from './firebase-admin'

const auditSampleLimit = 8
const channelSampleLimit = 30
const entityCountLimit = 8
const messageCollectionCandidates = ['messages', 'messages_live', 'thread', 'messages_historical']
const messageSampleLimitPerChannel = 10
const queueSampleLimit = 250
const userSampleLimit = 250

interface DashboardMessage {
  channelId: string
  content: string
  createdAt: Date | null
  user: string
}

interface DashboardCard {
  description: string
  href?: string
  kind: 'activity' | 'audit' | 'business' | 'pending' | 'users'
  label: string
  value: number | string
}

interface EntityStat {
  access: string
  count: number
  key: string
  label: string
  route: string
}

interface QueueStat {
  count: number
  label: string
  route: string
  type: string
}

export async function getDashboardStats() {
  const db = getFirebaseAdminFirestore()
  const businessEntities = adminPanelConfig.entities.filter(isBusinessEntity).slice(0, entityCountLimit)
  const channelsEntity = adminPanelConfig.entities.find(entity => entity.key === 'channels')

  const [
    totalUsers,
    userSnapshot,
    entityStats,
    queueStats,
    auditEvents,
    channelSnapshot,
  ] = await Promise.all([
    getCollectionCount(db.collection('users')),
    getLimitedSnapshot(db.collection('users'), 'createdAt', userSampleLimit),
    getEntityStats(businessEntities),
    getQueueStats(businessEntities),
    getRecentAuditEvents(),
    channelsEntity ? getLimitedSnapshot(db.collection(channelsEntity.collection), 'createdAt', channelSampleLimit) : null,
  ])

  const users = userSnapshot.docs.map(doc => doc.data())
  const activeUsers = users.filter(user => {
    return Boolean(
      user.lastOnline ||
        user.lastLogin ||
        user.pushToken ||
        user.isOnline ||
        user.active ||
        user.isActive,
    )
  }).length
  const messages = channelSnapshot
    ? (
        await Promise.all(
          channelSnapshot.docs.map(channel =>
            getChannelMessages(channel.ref).then(channelMessages =>
              channelMessages.map(message => serializeDashboardMessage(channel.id, message)),
            ),
          ),
        )
      ).flat()
    : []
  const monthNames = getRecentMonthLabels(6)
  const pendingTotal = queueStats.reduce((sum, queue) => sum + queue.count, 0)

  return {
    activeUsers,
    cards: buildDashboardCards(adminPanelConfig.dashboard.widgets, {
      activeUsers,
      auditEvents: auditEvents.length,
      engagementRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
      entityStats,
      pendingTotal,
      queueStats,
      totalUsers,
    }),
    engagementRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
    entityStats,
    monthNames,
    queueStats,
    recentActivity: getRecentActivity(auditEvents, messages),
    totalMessages: messages.length,
    totalUsers,
    userGrowthData: getUserGrowthData(users, monthNames),
    weeklyMessages: getWeeklyMessages(messages),
  }
}

function buildDashboardCards(
  widgets: AdminDashboardWidgetConfig[],
  data: {
    activeUsers: number
    auditEvents: number
    engagementRate: number
    entityStats: EntityStat[]
    pendingTotal: number
    queueStats: QueueStat[]
    totalUsers: number
  },
): DashboardCard[] {
  return widgets.map(widget => {
    const entityStat = widget.entity
      ? data.entityStats.find(
          entity =>
            entity.key === widget.entity ||
            entity.route === widget.entity ||
            entity.label === widget.entity,
        )
      : data.entityStats[0]
    const queueStat = widget.entity
      ? data.queueStats.find(queue => queue.route === widget.entity || queue.type === widget.entity)
      : data.queueStats[0]
    const value = readDashboardMetric(widget, {
      ...data,
      entityStat,
      queueStat,
    })

    return {
      description: widget.description,
      href: widget.href ?? inferWidgetHref(widget, entityStat, queueStat),
      kind: widget.kind,
      label: widget.label,
      value: typeof value === 'number' && widget.valueSuffix
        ? `${value}${widget.valueSuffix}`
        : value,
    }
  })
}

function readDashboardMetric(
  widget: AdminDashboardWidgetConfig,
  data: {
    activeUsers: number
    auditEvents: number
    engagementRate: number
    entityStat?: EntityStat
    pendingTotal: number
    queueStat?: QueueStat
    totalUsers: number
  },
) {
  if (widget.metric === 'activeUsers') {
    return data.activeUsers
  }

  if (widget.metric === 'auditEvents') {
    return data.auditEvents
  }

  if (widget.metric === 'engagementRate') {
    return data.engagementRate
  }

  if (widget.metric === 'entityCount') {
    return data.entityStat?.count ?? 0
  }

  if (widget.metric === 'pendingCount') {
    return widget.entity ? data.queueStat?.count ?? 0 : data.pendingTotal
  }

  return data.totalUsers
}

function inferWidgetHref(
  widget: AdminDashboardWidgetConfig,
  entityStat: EntityStat | undefined,
  queueStat: QueueStat | undefined,
) {
  if (widget.metric === 'entityCount' && entityStat) {
    return `/admin/${entityStat.route}`
  }

  if (widget.metric === 'pendingCount' && queueStat) {
    return `/admin/${queueStat.route}`
  }

  return undefined
}

async function getEntityStats(entities: AdminEntityConfig[]): Promise<EntityStat[]> {
  const db = getFirebaseAdminFirestore()

  return Promise.all(
    entities.map(async entity => ({
      access: entity.access,
      count: await getCollectionCount(db.collection(entity.collection)),
      key: entity.key,
      label: entity.displayName,
      route: entity.route,
    })),
  )
}

async function getQueueStats(entities: AdminEntityConfig[]): Promise<QueueStat[]> {
  const candidates = entities.filter(entity => {
    const key = `${entity.key} ${entity.route} ${entity.displayName}`.toLowerCase()
    return (
      key.includes('report') ||
      key.includes('review') ||
      key.includes('order') ||
      key.includes('booking') ||
      key.includes('provider') ||
      key.includes('driver') ||
      key.includes('restaurant') ||
      key.includes('listing')
    )
  })

  const queues = await Promise.all(candidates.map(getQueueStat))
  return queues
    .filter((queue): queue is QueueStat => Boolean(queue))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6)
}

async function getQueueStat(entity: AdminEntityConfig): Promise<QueueStat | null> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(entity.collection)
    .limit(queueSampleLimit)
    .get()
    .catch(() => null)

  if (!snapshot) {
    return null
  }

  const count = snapshot.docs.filter(doc => looksPending(doc.data(), entity)).length

  return {
    count,
    label: entity.displayName,
    route: entity.route,
    type: entity.key,
  }
}

function looksPending(data: FirebaseFirestore.DocumentData, entity: AdminEntityConfig) {
  const values = [
    data.status,
    data.orderStatus,
    data.paymentStatus,
    data.approvalStatus,
    data.reviewStatus,
    data.moderationStatus,
    data.verificationStatus,
    data.adminStatus,
  ]
    .map(value => readString(value).toLowerCase())
    .filter(Boolean)

  if (values.some(value => ['pending', 'open', 'new', 'reported', 'unverified'].includes(value))) {
    return true
  }

  if (data.approved === false || data.isApproved === false || data.verified === false) {
    return true
  }

  const key = `${entity.key} ${entity.route}`.toLowerCase()
  return key.includes('report') && data.resolved !== true && data.deleted !== true
}

async function getRecentAuditEvents() {
  const snapshot = await getFirebaseAdminFirestore()
    .collection('admin_audit_logs')
    .orderBy('createdAt', 'desc')
    .limit(auditSampleLimit)
    .get()
    .catch(() => null)

  if (!snapshot) {
    return []
  }

  return snapshot.docs.map(doc => {
    const data = doc.data()
    return {
      action: readString(data.action) || 'admin.action',
      actor: readString(data.actorEmail) || readString(data.actorUid) || 'Admin',
      createdAt: parseDate(data.createdAt),
      resource: readString(data.resourcePath) || readString(data.resourceType),
    }
  })
}

function getRecentActivity(
  auditEvents: Awaited<ReturnType<typeof getRecentAuditEvents>>,
  messages: DashboardMessage[],
) {
  const auditActivity = auditEvents.map(event => ({
    content: event.resource || event.action,
    timeAgo: getTimeAgo(event.createdAt),
    type: event.action,
    user: event.actor,
  }))
  const messageActivity = messages
    .slice()
    .sort((left, right) => {
      return (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0)
    })
    .slice(0, 8)
    .map(message => ({
      channelId: message.channelId,
      content: message.content,
      timeAgo: getTimeAgo(message.createdAt),
      type: 'message',
      user: message.user,
    }))

  return auditActivity.length > 0 ? auditActivity : messageActivity
}

async function getChannelMessages(channelRef: FirebaseFirestore.DocumentReference) {
  for (const candidate of messageCollectionCandidates) {
    const snapshot = await getLimitedSnapshot(
      channelRef.collection(candidate),
      'createdAt',
      messageSampleLimitPerChannel,
    )

    if (snapshot.docs.length > 0) {
      return snapshot.docs.map(doc => doc.data())
    }
  }

  return []
}

async function getCollectionCount(collection: FirebaseFirestore.CollectionReference) {
  try {
    const snapshot = await collection.count().get()
    return snapshot.data().count
  } catch {
    const snapshot = await collection.limit(1000).get()
    return snapshot.size
  }
}

async function getLimitedSnapshot(
  collection: FirebaseFirestore.CollectionReference,
  orderBy: string,
  limit: number,
) {
  try {
    return await collection.orderBy(orderBy, 'desc').limit(limit).get()
  } catch {
    return collection.limit(limit).get()
  }
}

function serializeDashboardMessage(
  channelId: string,
  data: FirebaseFirestore.DocumentData,
): DashboardMessage {
  return {
    channelId,
    content:
      readString(data.content) ||
      readString(data.text) ||
      readString(data.message) ||
      readString(data.url) ||
      'Message',
    createdAt: parseDate(data.createdAt),
    user:
      readString(data.senderName) ||
      readString(data.authorName) ||
      readString(data.senderFirstName) ||
      readString(data.senderID) ||
      readString(data.userID) ||
      'Unknown user',
  }
}

function getRecentMonthLabels(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (count - 1 - index))
    return date.toLocaleString('en', { month: 'short' })
  })
}

function getUserGrowthData(
  users: FirebaseFirestore.DocumentData[],
  monthNames: string[],
) {
  const counts = Object.fromEntries(monthNames.map(month => [month, 0])) as Record<
    string,
    number
  >

  for (const user of users) {
    const createdAt = parseDate(user.createdAt)
    if (!createdAt) {
      continue
    }

    const month = createdAt.toLocaleString('en', { month: 'short' })
    if (month in counts) {
      counts[month] += 1
    }
  }

  return monthNames.map(month => counts[month] ?? 0)
}

function getWeeklyMessages(messages: DashboardMessage[]) {
  const buckets = Array.from({ length: 7 }, () => 0)
  const today = startOfDay(new Date()).getTime()
  const dayMs = 24 * 60 * 60 * 1000

  for (const message of messages) {
    if (!message.createdAt) {
      continue
    }

    const diff = Math.floor((today - startOfDay(message.createdAt).getTime()) / dayMs)
    if (diff >= 0 && diff < buckets.length) {
      buckets[buckets.length - 1 - diff] += 1
    }
  }

  return buckets
}

function isBusinessEntity(entity: AdminEntityConfig) {
  return (
    entity.key !== 'users' &&
    entity.key !== 'emailTemplates' &&
    entity.access === 'readWrite' &&
    entity.collectionGroups.length === 0
  )
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

  if (typeof value === 'string' && /^\d{10}$/.test(value.trim())) {
    return parseDate(Number(value.trim()))
  }

  if (typeof value === 'string' && /^\d{13}$/.test(value.trim())) {
    return parseDate(Number(value.trim()))
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const timestamp = value as { toDate?: () => Date }
    const date = timestamp.toDate?.()
    return date && !Number.isNaN(date.getTime()) ? date : null
  }

  if (
    typeof value === 'object' &&
    ('seconds' in value || '_seconds' in value)
  ) {
    const timestamp = value as { seconds?: unknown; _seconds?: unknown }
    const seconds =
      typeof timestamp.seconds === 'number' ? timestamp.seconds : timestamp._seconds

    return typeof seconds === 'number' ? parseDate(seconds) : null
  }

  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getTimeAgo(date: Date | null) {
  if (!date) {
    return 'Unknown time'
  }

  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < hour) {
    return Math.max(1, Math.round(diffMs / minute)) + 'm ago'
  }

  if (diffMs < day) {
    return Math.round(diffMs / hour) + 'h ago'
  }

  return Math.round(diffMs / day) + 'd ago'
}
