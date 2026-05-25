import 'server-only'

import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { getDocumentRef } from './firestore-crud-utils'
import { HttpError } from './http'

const sampleLimit = 300
const recentChannelLimit = 80
const messagesPerChannelLimit = 20
const gptAssistantUserID = 'AAAAAAAchatGPTUserID'
const messagingMobileApps = new Set(['chat', 'gptchat', 'videoChat'])
const messagingActions = new Set([
  'clear_escalation',
  'clear_support_handoff',
  'mark_escalated',
  'mark_reviewed',
  'mark_support_handoff',
])
const activeCallStatuses = new Set(['initiated', 'started', 'active', 'incoming', 'outgoing'])
const safetyTerms = [
  'abuse',
  'blocked',
  'danger',
  'error',
  'harass',
  'harm',
  'hate',
  'kill',
  'offensive',
  'report',
  'scam',
  'spam',
  'unsafe',
]

export interface MessagingConversationSummary {
  id: string
  issues: string[]
  lastMessage: string
  lastMessageAt?: string
  name: string
  participantCount: number
  route?: string
  type: 'assistant' | 'group' | 'direct' | 'unknown'
}

export interface MessagingMessageSummary {
  channelID: string
  content: string
  createdAt?: string
  flags: string[]
  id: string
  isAssistant: boolean
  kind: 'text' | 'media' | 'missed_call' | 'unknown'
  path: string
  sender: string
}

export interface MessagingCallSummary {
  activeParticipants: number
  callType: string
  channelID: string
  channelName: string
  durationMinutes: number
  endedAt?: string
  id: string
  initiatedAt?: string
  issues: string[]
  startedAt?: string
  status: string
}

export interface MessagingOperationsOverview {
  channels: {
    assistantChannels: number
    direct: number
    group: number
    recent: MessagingConversationSummary[]
    stale: number
    total: number
    withIssues: MessagingConversationSummary[]
  }
  entities: {
    avCallConnectionData?: string
    avCallStatuses?: string
    avCalls?: string
    channels?: string
  }
  gpt: {
    assistantMessages: number
    averageTokensPerPrompt: number
    enabled: boolean
    estimatedMonthlyCost: number
    estimatedSampleCost: number
    estimatedSampleTokens: number
    model: string
    openAIConfigured: boolean
    userPrompts: number
  }
  isEnabled: boolean
  messages: {
    flagged: MessagingMessageSummary[]
    media: number
    missedCalls: number
    recent: MessagingMessageSummary[]
    sampled: number
  }
  support: {
    escalated: MessagingConversationSummary[]
    needsHandoff: MessagingConversationSummary[]
    reviewed: number
    unreviewed: number
  }
  video: {
    activeCalls: MessagingCallSummary[]
    connectionEvents: number
    enabled: boolean
    failedCalls: MessagingCallSummary[]
    recentCalls: MessagingCallSummary[]
    statusCounts: Array<{ count: number; status: string }>
    statusDocuments: number
    totalCalls: number
  }
}

export async function getMessagingOperationsOverview(): Promise<MessagingOperationsOverview> {
  const entities = getMessagingEntities()

  if (!isMessagingPanel(entities)) {
    return emptyOverview(false, entities)
  }

  const isGptEnabled = isGptPanel()
  const isVideoEnabled = isVideoPanel(entities)
  const [
    channelRows,
    channelCount,
    callRows,
    callCount,
    callStatusRows,
    callStatusCount,
    connectionRows,
    connectionCount,
  ] = await Promise.all([
    entities.channels ? listEntityRows(entities.channels, recentChannelLimit) : Promise.resolve([]),
    countEntityDocs(entities.channels),
    isVideoEnabled && entities.avCalls
      ? listEntityRows(entities.avCalls, sampleLimit)
      : Promise.resolve([]),
    isVideoEnabled ? countEntityDocs(entities.avCalls) : Promise.resolve(0),
    isVideoEnabled && entities.avCallStatuses
      ? listEntityRows(entities.avCallStatuses, sampleLimit)
      : Promise.resolve([]),
    isVideoEnabled ? countEntityDocs(entities.avCallStatuses) : Promise.resolve(0),
    isVideoEnabled && entities.avCallConnectionData
      ? listEntityRows(entities.avCallConnectionData, sampleLimit)
      : Promise.resolve([]),
    isVideoEnabled ? countEntityDocs(entities.avCallConnectionData) : Promise.resolve(0),
  ])

  const channelSummaries = channelRows
    .map(buildConversationSummary)
    .sort((left, right) => readTime(right.lastMessageAt) - readTime(left.lastMessageAt))
  const messageRows = entities.channels
    ? await listRecentChannelMessages(entities.channels, channelRows)
    : []
  const messageSummaries = messageRows
    .map(buildMessageSummary)
    .sort((left, right) => readTime(right.createdAt) - readTime(left.createdAt))
  const callSummaries = callRows
    .map(buildCallSummary)
    .sort((left, right) => readTime(right.initiatedAt) - readTime(left.initiatedAt))
  const sampledText = messageSummaries.map(message => message.content).join(' ')
  const estimatedSampleTokens = estimateTokens(sampledText)
  const userPromptCount = messageSummaries.filter(message => message.kind === 'text' && !message.isAssistant).length
  const estimatedSampleCost = estimateGptCost(estimatedSampleTokens)

  return {
    channels: {
      assistantChannels: channelSummaries.filter(channel => channel.type === 'assistant').length,
      direct: channelSummaries.filter(channel => channel.type === 'direct').length,
      group: channelSummaries.filter(channel => channel.type === 'group').length,
      recent: channelSummaries.slice(0, 12),
      stale: channelSummaries.filter(channel => channel.issues.includes('No recent message')).length,
      total: channelCount,
      withIssues: channelSummaries.filter(channel => channel.issues.length > 0).slice(0, 12),
    },
    entities: serializeMessagingEntities(entities),
    gpt: {
      assistantMessages: messageSummaries.filter(message => message.isAssistant).length,
      averageTokensPerPrompt: userPromptCount > 0
        ? Math.round(estimatedSampleTokens / userPromptCount)
        : 0,
      enabled: isGptEnabled || channelSummaries.some(channel => channel.type === 'assistant'),
      estimatedMonthlyCost: estimateGptCost(estimatedSampleTokens * 30),
      estimatedSampleCost,
      estimatedSampleTokens,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      openAIConfigured: Boolean(process.env.OPENAI_API_KEY),
      userPrompts: userPromptCount,
    },
    isEnabled: true,
    messages: {
      flagged: messageSummaries.filter(message => message.flags.length > 0).slice(0, 12),
      media: messageSummaries.filter(message => message.kind === 'media').length,
      missedCalls: messageSummaries.filter(message => message.kind === 'missed_call').length,
      recent: messageSummaries.slice(0, 12),
      sampled: messageSummaries.length,
    },
    support: {
      escalated: channelSummaries
        .filter(channel => channel.issues.includes('Escalated'))
        .slice(0, 12),
      needsHandoff: channelSummaries
        .filter(channel => channel.issues.includes('Support follow-up'))
        .slice(0, 12),
      reviewed: channelRows.filter(row => row.adminReviewedAt).length,
      unreviewed: channelRows.filter(row => !row.adminReviewedAt).length,
    },
    video: {
      activeCalls: callSummaries
        .filter(call => activeCallStatuses.has(call.status))
        .slice(0, 12),
      connectionEvents: connectionCount,
      enabled: isVideoEnabled,
      failedCalls: callSummaries
        .filter(call => call.issues.length > 0 || ['rejected', 'failed'].includes(call.status))
        .slice(0, 12),
      recentCalls: callSummaries.slice(0, 12),
      statusCounts: countByStatus([...callRows, ...callStatusRows]),
      statusDocuments: callStatusCount,
      totalCalls: callCount,
    },
  }
}

export async function runMessagingOperationAction(
  resource: string,
  id: string,
  action: string,
  actor: AdminSessionUser,
) {
  const entities = getMessagingEntities()

  if (!isMessagingPanel(entities)) {
    throw new HttpError('Messaging Operations is not enabled for this panel.', 404)
  }

  if (!messagingActions.has(action)) {
    throw new HttpError('Unsupported messaging operation action.', 400)
  }

  const target = resolveActionTarget(resource, entities)
  const ref = getDocumentRef(target.entity, validateTopLevelId(id))
  const snapshot = await ref.get()

  if (!snapshot.exists) {
    throw new HttpError('Messaging resource was not found.', 404)
  }

  const now = Date.now()
  const patch: Record<string, unknown> = {
    adminUpdatedAt: now,
    adminUpdatedBy: actor.uid,
    updatedAt: now,
  }

  if (action === 'mark_reviewed') {
    patch.adminReviewedAt = now
    patch.adminReviewedBy = actor.uid
  } else if (action === 'mark_escalated') {
    patch.adminEscalated = true
    patch.adminEscalatedAt = now
    patch.adminEscalatedBy = actor.uid
  } else if (action === 'clear_escalation') {
    patch.adminEscalated = false
    patch.adminEscalationClearedAt = now
    patch.adminEscalationClearedBy = actor.uid
  } else if (action === 'mark_support_handoff') {
    patch.adminSupportHandoff = true
    patch.adminSupportHandoffAt = now
    patch.adminSupportHandoffBy = actor.uid
  } else if (action === 'clear_support_handoff') {
    patch.adminSupportHandoff = false
    patch.adminSupportHandoffClearedAt = now
    patch.adminSupportHandoffClearedBy = actor.uid
  }

  await ref.set(patch, { merge: true })
  await writeAuditLog({
    action: `messaging.${action}`,
    actor,
    metadata: { resource: target.resource },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: target.entity.key,
  })

  return {
    action,
    id,
    resource: target.resource,
    success: true,
  }
}

function getMessagingEntities() {
  return {
    avCallConnectionData: findEntity(['avCallConnectionData', 'call-connection-data']),
    avCallStatuses: findEntity(['avCallStatuses', 'call-statuses']),
    avCalls: findEntity(['avCalls', 'video-calls']),
    channels: findEntity(['channels', 'chats']),
  }
}

function isMessagingPanel(entities: ReturnType<typeof getMessagingEntities>) {
  return (
    adminPanelConfig.features.includes('chat') ||
    messagingMobileApps.has(adminPanelConfig.mobileApp) ||
    Boolean(entities.channels)
  )
}

function isGptPanel() {
  return adminPanelConfig.mobileApp === 'gptchat'
}

function isVideoPanel(entities: ReturnType<typeof getMessagingEntities>) {
  return adminPanelConfig.mobileApp === 'videoChat' || Boolean(entities.avCalls)
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

  const snapshot = await query.limit(limit).get().catch(async () => {
    return db.collection(entity.collection).limit(limit).get()
  })
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
  }) as Record<string, unknown>)
}

async function listRecentChannelMessages(
  channelsEntity: AdminEntityConfig,
  channelRows: Array<Record<string, unknown>>,
) {
  const db = getFirebaseAdminFirestore()
  const messagesByPath = new Map<string, Record<string, unknown>>()
  const channelIDs = channelRows
    .map(channel => readString(channel.id) || readString(channel.channelID))
    .filter(Boolean)
    .slice(0, 24)

  await Promise.all(
    channelIDs.map(async channelID => {
      const channelRef = db.collection(channelsEntity.collection).doc(channelID)
      const snapshots = await Promise.all(
        ['messages_live', 'messages', 'messages_historical'].map(collection =>
          channelRef
            .collection(collection)
            .orderBy('createdAt', 'desc')
            .limit(messagesPerChannelLimit)
            .get()
            .catch(() =>
              channelRef.collection(collection).limit(messagesPerChannelLimit).get().catch(() => null),
            ),
        ),
      )

      snapshots.forEach(snapshot => {
        snapshot?.docs.forEach(doc => {
          messagesByPath.set(doc.ref.path, {
            ...doc.data(),
            _channelID: channelID,
            _path: doc.ref.path,
            id: doc.id,
          })
        })
      })
    }),
  )

  return [...messagesByPath.values()]
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

function buildConversationSummary(row: Record<string, unknown>): MessagingConversationSummary {
  const participantIDs = getParticipantIDs(row)
  const lastMessageAt = formatDate(row.lastMessageDate ?? row.createdAt)
  const issues: string[] = []

  if (participantIDs.length === 0) {
    issues.push('Missing participants')
  }

  if (!readString(row.lastMessage) && !readString(row.lastThreadMessageId)) {
    issues.push('No messages')
  }

  if (isStale(row.lastMessageDate ?? row.createdAt, 14)) {
    issues.push('No recent message')
  }

  if (row.adminEscalated === true) {
    issues.push('Escalated')
  }

  if (row.adminSupportHandoff === true) {
    issues.push('Support follow-up')
  }

  return {
    id: readString(row.id) || readString(row.channelID),
    issues,
    lastMessage: readString(row.lastMessage) || readString(row.lastThreadMessageId),
    lastMessageAt: lastMessageAt ?? undefined,
    name: readString(row.name) || buildParticipantLabel(row.participants) || 'Conversation',
    participantCount: participantIDs.length,
    route: findEntity(['channels', 'chats'])?.route,
    type: getConversationType(row, participantIDs),
  }
}

function buildMessageSummary(row: Record<string, unknown>): MessagingMessageSummary {
  const content = readString(row.content) || readString(row.text) || readString(row.media)
  const flags = getMessageFlags(row, content)
  const kind = getMessageKind(row)
  const senderID = readString(row.senderID)

  return {
    channelID: readString(row._channelID) || readString(row.channelID),
    content: content || (kind === 'media' ? 'Media message' : kind === 'missed_call' ? 'Missed call' : ''),
    createdAt: formatDate(row.createdAt) ?? undefined,
    flags,
    id: readString(row.id),
    isAssistant: senderID === gptAssistantUserID || readString(row.senderFirstName).toLowerCase().includes('assistant'),
    kind,
    path: readString(row._path),
    sender: [readString(row.senderFirstName), readString(row.senderLastName)].filter(Boolean).join(' ') ||
      senderID ||
      'Unknown sender',
  }
}

function buildCallSummary(row: Record<string, unknown>): MessagingCallSummary {
  const activeParticipants = readArray(row.activeParticipants).length
  const status = readString(row.status) || 'unknown'
  const startTime = readTime(row.callStartTimestamp ?? row.startedAt ?? row.initiatedTimestamp)
  const endTime = readTime(row.callEndTimestamp ?? row.endedAt ?? row.updatedAt)
  const issues: string[] = []

  if (activeCallStatuses.has(status) && isStale(row.initiatedTimestamp, 1)) {
    issues.push('Stale active call')
  }

  if (activeCallStatuses.has(status) && activeParticipants === 0) {
    issues.push('No active participants')
  }

  if (row.adminEscalated === true) {
    issues.push('Escalated')
  }

  return {
    activeParticipants,
    callType: readString(row.callType) || 'call',
    channelID: readString(row.channelID),
    channelName: readString(row.channelName) || readString(row.channelID) || 'Video call',
    durationMinutes: startTime > 0 && endTime > startTime
      ? Math.round((endTime - startTime) / 60000)
      : 0,
    endedAt: formatDate(row.callEndTimestamp ?? row.endedAt ?? row.updatedAt) ?? undefined,
    id: readString(row.callID) || readString(row.id),
    initiatedAt: formatDate(row.initiatedTimestamp ?? row.createdAt) ?? undefined,
    issues,
    startedAt: formatDate(row.callStartTimestamp ?? row.startedAt) ?? undefined,
    status,
  }
}

function getMessageKind(row: Record<string, unknown>): MessagingMessageSummary['kind'] {
  if (row.missedCallMessage === true || readArray(row.missedCallUserIDs).length > 0) {
    return 'missed_call'
  }

  if (hasMedia(row.media) || hasMedia(row.url) || hasMedia(row.downloadURL)) {
    return 'media'
  }

  if (readString(row.content) || readString(row.text)) {
    return 'text'
  }

  return 'unknown'
}

function getMessageFlags(row: Record<string, unknown>, content: string) {
  const flags: string[] = []
  const normalizedContent = content.toLowerCase()

  if (row.adminEscalated === true) {
    flags.push('Escalated')
  }

  if (normalizedContent && safetyTerms.some(term => normalizedContent.includes(term))) {
    flags.push('Safety keyword')
  }

  if (readString(row.error) || readString(row.errorCode)) {
    flags.push('Error state')
  }

  if (row.missedCallMessage === true) {
    flags.push('Missed call')
  }

  return flags
}

function getConversationType(row: Record<string, unknown>, participantIDs: string[]): MessagingConversationSummary['type'] {
  if (participantIDs.includes(gptAssistantUserID) || readString(row.name).toLowerCase().includes('assistant')) {
    return 'assistant'
  }

  if (participantIDs.length === 2) {
    return 'direct'
  }

  if (participantIDs.length > 2) {
    return 'group'
  }

  return 'unknown'
}

function getParticipantIDs(row: Record<string, unknown>) {
  const participantIDs = readArray(row.participantIDs).map(readString).filter(Boolean)

  if (participantIDs.length > 0) {
    return participantIDs
  }

  return readArray(row.participants)
    .map(participant => {
      if (!participant || typeof participant !== 'object' || Array.isArray(participant)) {
        return ''
      }

      const participantRow = participant as Record<string, unknown>
      return readString(participantRow.id) || readString(participantRow.userID)
    })
    .filter(Boolean)
}

function resolveActionTarget(resource: string, entities: ReturnType<typeof getMessagingEntities>) {
  const normalized = resource.trim()

  if (['channels', 'chats', 'conversations'].includes(normalized)) {
    if (!entities.channels) {
      throw new HttpError('Chat channels are not configured for this panel.', 404)
    }

    return { entity: entities.channels, resource: 'channels' }
  }

  if (['avCalls', 'video-calls', 'calls'].includes(normalized)) {
    if (!entities.avCalls) {
      throw new HttpError('Video calls are not configured for this panel.', 404)
    }

    return { entity: entities.avCalls, resource: 'avCalls' }
  }

  throw new HttpError('Unsupported messaging resource.', 400)
}

function emptyOverview(
  isEnabled: boolean,
  entities: ReturnType<typeof getMessagingEntities>,
): MessagingOperationsOverview {
  return {
    channels: {
      assistantChannels: 0,
      direct: 0,
      group: 0,
      recent: [],
      stale: 0,
      total: 0,
      withIssues: [],
    },
    entities: serializeMessagingEntities(entities),
    gpt: {
      assistantMessages: 0,
      averageTokensPerPrompt: 0,
      enabled: isGptPanel(),
      estimatedMonthlyCost: 0,
      estimatedSampleCost: 0,
      estimatedSampleTokens: 0,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      openAIConfigured: Boolean(process.env.OPENAI_API_KEY),
      userPrompts: 0,
    },
    isEnabled,
    messages: {
      flagged: [],
      media: 0,
      missedCalls: 0,
      recent: [],
      sampled: 0,
    },
    support: {
      escalated: [],
      needsHandoff: [],
      reviewed: 0,
      unreviewed: 0,
    },
    video: {
      activeCalls: [],
      connectionEvents: 0,
      enabled: isVideoPanel(entities),
      failedCalls: [],
      recentCalls: [],
      statusCounts: [],
      statusDocuments: 0,
      totalCalls: 0,
    },
  }
}

function serializeMessagingEntities(entities: ReturnType<typeof getMessagingEntities>) {
  return {
    avCallConnectionData: entities.avCallConnectionData?.route,
    avCallStatuses: entities.avCallStatuses?.route,
    avCalls: entities.avCalls?.route,
    channels: entities.channels?.route,
  }
}

function countByStatus(rows: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>()

  rows.forEach(row => {
    const status = readString(row.status) || 'unknown'
    counts.set(status, (counts.get(status) ?? 0) + 1)
  })

  return [...counts.entries()]
    .map(([status, count]) => ({ count, status }))
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

function buildParticipantLabel(value: unknown) {
  const names = readArray(value)
    .map(participant => {
      if (!participant || typeof participant !== 'object' || Array.isArray(participant)) {
        return ''
      }

      const row = participant as Record<string, unknown>
      return [readString(row.firstName), readString(row.lastName)].filter(Boolean).join(' ') ||
        readString(row.email) ||
        readString(row.name)
    })
    .filter(Boolean)

  return names.slice(0, 3).join(', ')
}

function hasMedia(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.some(item => hasMedia(item))
  }

  return Boolean(value)
}

function estimateTokens(value: string) {
  return Math.ceil(value.length / 4)
}

function estimateGptCost(tokens: number) {
  return Math.round((tokens / 1000000) * 0.15 * 10000) / 10000
}

function isStale(value: unknown, days: number) {
  const time = readTime(value)

  if (time === 0) {
    return true
  }

  return Date.now() - time > days * 24 * 60 * 60 * 1000
}

function formatDate(value: unknown) {
  const date = parseDate(value)
  return date?.toISOString() ?? null
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return typeof value === 'string' ? value.trim() : ''
}

function readTime(value: unknown) {
  const date = parseDate(value)
  return date?.getTime() ?? 0
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
