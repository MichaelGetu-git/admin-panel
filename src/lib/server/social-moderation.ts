import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { getDocumentRef } from './firestore-crud-utils'
import { HttpError } from './http'

const sampleLimit = 250
const socialMobileApps = new Set(['socialNetwork', 'instagram', 'tiktok'])
const socialResourceRoutes = new Set(['posts', 'comments', 'stories', 'reports', 'songs', 'users'])

export type SocialModerationAction =
  | 'approve'
  | 'ban_author'
  | 'delete'
  | 'feature'
  | 'hide'
  | 'resolve'
  | 'show'
  | 'unban_author'
  | 'unfeature'

export interface SocialModerationItem {
  author: string
  authorID: string
  commentsCount: number
  createdAt?: string
  engagementScore: number
  hashtags: string[]
  id: string
  isFeatured: boolean
  mediaCount: number
  preview: string
  reason: string
  reactionsCount: number
  resource: string
  song: string
  status: string
  title: string
}

export interface SocialCreatorSummary {
  comments: number
  email: string
  id: string
  issues: string[]
  name: string
  photo: string
  posts: number
  reactions: number
  reports: number
  stories: number
}

export interface SocialTopicSummary {
  count: number
  tag: string
}

export interface SocialMusicSummary {
  artist: string
  id: string
  isFeatured: boolean
  issues: string[]
  status: string
  title: string
}

export interface SocialModerationOverview {
  creators: {
    highRisk: SocialCreatorSummary[]
    needingProfile: SocialCreatorSummary[]
    top: SocialCreatorSummary[]
  }
  curation: {
    candidates: SocialModerationItem[]
    featured: number
    topHashtags: SocialTopicSummary[]
  }
  entities: {
    comments?: string
    posts?: string
    reports?: string
    songs?: string
    stories?: string
    users?: string
  }
  isEnabled: boolean
  metrics: {
    comments: number
    contentIssues: number
    curationCandidates: number
    flaggedContent: number
    highRiskCreators: number
    hashtags: number
    musicIssues: number
    posts: number
    reports: number
    songs: number
    stories: number
    users: number
  }
  music: {
    readinessIssues: SocialMusicSummary[]
    recent: SocialMusicSummary[]
  }
  queues: {
    contentIssues: SocialModerationItem[]
    flaggedContent: SocialModerationItem[]
    reports: SocialModerationItem[]
  }
  statusCounts: {
    comments: Array<{ count: number; status: string }>
    posts: Array<{ count: number; status: string }>
    reports: Array<{ count: number; status: string }>
    stories: Array<{ count: number; status: string }>
  }
}

export async function getSocialModerationOverview(): Promise<SocialModerationOverview> {
  const entities = getSocialEntities()
  const isEnabled = isSocialModerationPanel(entities)

  if (!isEnabled) {
    return emptyOverview(false, entities)
  }

  const [
    usersCount,
    postsCount,
    commentsCount,
    storiesCount,
    reportsCount,
    songsCount,
    postRows,
    commentRows,
    storyRows,
    reportRows,
    songRows,
  ] = await Promise.all([
    countEntityDocs(entities.users),
    countEntityDocs(entities.posts),
    countEntityDocs(entities.comments),
    countEntityDocs(entities.stories),
    countEntityDocs(entities.reports),
    countEntityDocs(entities.songs),
    entities.posts ? listEntityRows(entities.posts) : Promise.resolve([]),
    entities.comments ? listEntityRows(entities.comments) : Promise.resolve([]),
    entities.stories ? listEntityRows(entities.stories) : Promise.resolve([]),
    entities.reports ? listEntityRows(entities.reports, 100) : Promise.resolve([]),
    entities.songs ? listEntityRows(entities.songs, 100) : Promise.resolve([]),
  ])
  const flaggedContent = [
    ...buildFlaggedQueue(entities.posts, postRows),
    ...buildFlaggedQueue(entities.comments, commentRows),
    ...buildFlaggedQueue(entities.stories, storyRows),
  ]
    .sort(sortByCreatedAtDesc)
    .slice(0, 20)
  const contentIssues = [
    ...buildContentIssueQueue(entities.posts, postRows),
    ...buildContentIssueQueue(entities.comments, commentRows),
    ...buildContentIssueQueue(entities.stories, storyRows),
  ]
    .sort(sortByCreatedAtDesc)
    .slice(0, 20)
  const reports = buildReportsQueue(entities.reports, reportRows).slice(0, 20)
  const creatorSummaries = await buildCreatorSummaries(entities.users, {
    comments: commentRows,
    posts: postRows,
    reports: reportRows,
    stories: storyRows,
  })
  const topHashtags = buildTopHashtags(postRows)
  const curationCandidates = [
    ...buildCurationCandidateQueue(entities.posts, postRows),
    ...buildCurationCandidateQueue(entities.stories, storyRows),
  ]
    .sort((left, right) => right.reactionsCount - left.reactionsCount)
    .slice(0, 12)
  const musicReadinessIssues = buildMusicSummaries(songRows)
    .filter(song => song.issues.length > 0)
    .slice(0, 12)

  return {
    creators: {
      highRisk: creatorSummaries
        .filter(creator => creator.reports > 0)
        .sort((left, right) => right.reports - left.reports)
        .slice(0, 12),
      needingProfile: creatorSummaries
        .filter(creator => creator.issues.length > 0)
        .slice(0, 12),
      top: creatorSummaries
        .slice()
        .sort((left, right) => right.reactions - left.reactions)
        .slice(0, 12),
    },
    curation: {
      candidates: curationCandidates,
      featured: [...postRows, ...storyRows].filter(row => isFeatured(row)).length,
      topHashtags,
    },
    entities: serializeSocialEntities(entities),
    isEnabled,
    metrics: {
      comments: commentsCount,
      contentIssues: contentIssues.length,
      curationCandidates: curationCandidates.length,
      flaggedContent: flaggedContent.length,
      highRiskCreators: creatorSummaries.filter(creator => creator.reports > 0).length,
      hashtags: topHashtags.length,
      musicIssues: musicReadinessIssues.length,
      posts: postsCount,
      reports: reportsCount,
      songs: songsCount,
      stories: storiesCount,
      users: usersCount,
    },
    music: {
      readinessIssues: musicReadinessIssues,
      recent: buildMusicSummaries(songRows).slice(0, 8),
    },
    queues: {
      contentIssues,
      flaggedContent,
      reports,
    },
    statusCounts: {
      comments: countByStatus(commentRows),
      posts: countByStatus(postRows),
      reports: countByStatus(reportRows),
      stories: countByStatus(storyRows),
    },
  }
}

export async function applySocialModerationAction(
  resource: string,
  id: string,
  action: SocialModerationAction,
  actor: AdminSessionUser,
) {
  const entities = getSocialEntities()

  if (!isSocialModerationPanel(entities)) {
    throw new HttpError('Social moderation is not enabled for this panel.', 404)
  }

  const entity = findModerationEntity(entities, resource)

  if (!entity) {
    throw new HttpError('Unsupported moderation resource.', 404)
  }

  const ref = getDocumentRef(entity, id)
  const snapshot = await ref.get()

  if (action === 'delete') {
    await ref.delete()
  } else if ((action === 'ban_author' || action === 'unban_author') && entity.route !== 'users') {
    const authorID = readString(snapshot.data()?.authorID)

    if (!entities.users || !authorID) {
      throw new HttpError('Author profile is required for this action.', 400)
    }

    await getDocumentRef(entities.users, authorID).set(buildActionPatch(entities.users, action, actor), {
      merge: true,
    })
  } else {
    await ref.set(buildActionPatch(entity, action, actor), { merge: true })
  }

  await writeAuditLog({
    action: `social_moderation.${action}`,
    actor,
    metadata: { action, resource },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entity.key,
  })

  return {
    action,
    id,
    resource,
    success: true,
  }
}

function getSocialEntities() {
  return {
    comments: findEntity(['comments']),
    posts: findEntity(['posts']),
    reports: findEntity(['reports']),
    songs: findEntity(['songs']),
    stories: findEntity(['stories']),
    users: findEntity(['users']),
  }
}

function isSocialModerationPanel(entities: ReturnType<typeof getSocialEntities>) {
  return (
    socialMobileApps.has(adminPanelConfig.mobileApp) ||
    Boolean(entities.posts || entities.comments || entities.stories)
  )
}

function findModerationEntity(
  entities: ReturnType<typeof getSocialEntities>,
  resource: string,
) {
  if (!socialResourceRoutes.has(resource)) {
    return null
  }

  return Object.values(entities).find(entity => {
    return entity?.route === resource || entity?.key === resource
  }) ?? null
}

function buildActionPatch(
  entity: AdminEntityConfig,
  action: Exclude<SocialModerationAction, 'delete'>,
  actor: AdminSessionUser,
) {
  const patch: Record<string, unknown> = {
    moderationUpdatedAt: FieldValue.serverTimestamp(),
    moderationUpdatedBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (action === 'hide') {
    patch.hidden = true
    patch.isHidden = true
    patch.moderationStatus = 'hidden'
  }

  if (action === 'show') {
    patch.hidden = false
    patch.isHidden = false
    patch.moderationStatus = 'active'
  }

  if (action === 'approve') {
    patch.approved = true
    patch.isApproved = true
    patch.moderationStatus = 'approved'
  }

  if (action === 'resolve') {
    patch.resolved = true
    patch.moderationStatus = 'resolved'
    patch.resolvedAt = FieldValue.serverTimestamp()
    patch.resolvedBy = actor.uid
  }

  if (action === 'feature') {
    patch.featured = true
    patch.isFeatured = true
    patch.curationStatus = 'featured'
  }

  if (action === 'unfeature') {
    patch.featured = false
    patch.isFeatured = false
    patch.curationStatus = 'standard'
  }

  if (action === 'ban_author') {
    patch.adminDisabled = true
    patch.disabled = true
    patch.isDisabled = true
    patch.moderationStatus = 'disabled'
  }

  if (action === 'unban_author') {
    patch.adminDisabled = false
    patch.disabled = false
    patch.isDisabled = false
    patch.moderationStatus = 'active'
  }

  if (entity.fields.status && typeof patch.moderationStatus === 'string') {
    patch.status = patch.moderationStatus
  }

  return patch
}

async function listEntityRows(entity: AdminEntityConfig, limit = sampleLimit) {
  const docs = await listEntityDocs(entity, limit)
  return docs.map(doc => serializeRow(doc, entity.collectionGroups.length > 0))
}

async function listEntityDocs(entity: AdminEntityConfig, limit = sampleLimit) {
  const db = getFirebaseAdminFirestore()

  if (entity.collectionGroups.length > 0) {
    const groupLimit = Math.max(1, Math.ceil(limit / entity.collectionGroups.length))
    const snapshots = await Promise.all(
      entity.collectionGroups.map(group => db.collectionGroup(group).limit(groupLimit).get()),
    )

    return snapshots.flatMap(snapshot => snapshot.docs)
  }

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
    db.collection(entity.collection)

  if (entity.orderBy) {
    query = query.orderBy(entity.orderBy.field, entity.orderBy.direction)
  }

  return (await query.limit(limit).get()).docs
}

async function countEntityDocs(entity: AdminEntityConfig | undefined) {
  if (!entity) {
    return 0
  }

  const db = getFirebaseAdminFirestore()

  if (entity.collectionGroups.length > 0) {
    const counts = await Promise.all(
      entity.collectionGroups.map(async group => {
        try {
          const snapshot = await db.collectionGroup(group).count().get()
          return snapshot.data().count
        } catch {
          return (await db.collectionGroup(group).limit(sampleLimit).get()).size
        }
      }),
    )
    return counts.reduce((sum, count) => sum + count, 0)
  }

  try {
    const snapshot = await db.collection(entity.collection).count().get()
    return snapshot.data().count
  } catch {
    return (await db.collection(entity.collection).limit(sampleLimit).get()).size
  }
}

function buildFlaggedQueue(
  entity: AdminEntityConfig | undefined,
  rows: Array<Record<string, unknown>>,
) {
  if (!entity) {
    return []
  }

  return rows
    .map(row => ({ reason: readModerationReason(row), row }))
    .filter(item => item.reason)
    .map(item => buildItem(entity, item.row, item.reason))
}

function buildContentIssueQueue(
  entity: AdminEntityConfig | undefined,
  rows: Array<Record<string, unknown>>,
) {
  if (!entity) {
    return []
  }

  return rows
    .map(row => ({ reason: readContentIssueReason(entity.route, row), row }))
    .filter(item => item.reason)
    .map(item => buildItem(entity, item.row, item.reason))
}

function buildReportsQueue(
  entity: AdminEntityConfig | undefined,
  rows: Array<Record<string, unknown>>,
) {
  if (!entity) {
    return []
  }

  return rows
    .filter(row => !isResolved(row))
    .sort((left, right) => readTime(right.createdAt) - readTime(left.createdAt))
    .map(row => buildItem(entity, row, readString(row.type) || readString(row.reason) || 'Report'))
}

function buildCurationCandidateQueue(
  entity: AdminEntityConfig | undefined,
  rows: Array<Record<string, unknown>>,
) {
  if (!entity) {
    return []
  }

  return rows
    .filter(row => !isFeatured(row))
    .filter(row => !readBoolean(row.isHidden) && !readBoolean(row.hidden))
    .filter(row => readNumber(row.reactionsCount) >= 5 || hasMedia(row.postMedia ?? row.storyMediaURL))
    .map(row => buildItem(entity, row, 'High engagement candidate'))
}

async function buildCreatorSummaries(
  usersEntity: AdminEntityConfig | undefined,
  rows: {
    comments: Array<Record<string, unknown>>
    posts: Array<Record<string, unknown>>
    reports: Array<Record<string, unknown>>
    stories: Array<Record<string, unknown>>
  },
): Promise<SocialCreatorSummary[]> {
  if (!usersEntity) {
    return []
  }

  const users = await listEntityRows(usersEntity, 100)
  const postsByAuthor = countByField(rows.posts, 'authorID')
  const storiesByAuthor = countByField(rows.stories, 'authorID')
  const commentsByAuthor = countByField(rows.comments, 'authorID')
  const reportsByUser = countByField(rows.reports, 'dest')

  return users.map(user => {
    const id = readString(user.id) || readString(user.userID)
    const issues: string[] = []

    if (!readString(user.firstName) && !readString(user.username)) {
      issues.push('Missing display name')
    }

    if (!hasMedia(user.profilePictureURL) && !hasMedia(user.photos)) {
      issues.push('Missing profile media')
    }

    if (!readString(user.email) && !readString(user.phone)) {
      issues.push('Missing contact')
    }

    if (readBoolean(user.disabled) || readBoolean(user.isDisabled) || readBoolean(user.adminDisabled)) {
      issues.push('Disabled account')
    }

    return {
      comments: commentsByAuthor.get(id) ?? 0,
      email: readString(user.email),
      id,
      issues,
      name: [readString(user.firstName), readString(user.lastName)].filter(Boolean).join(' ') ||
        readString(user.username) ||
        readString(user.email) ||
        'Creator',
      photo: readString(user.profilePictureURL) || readFirstString(user.photos),
      posts: postsByAuthor.get(id) ?? readNumber(user.postsCount ?? user.postCount),
      reactions: readNumber(user.reactionsCount),
      reports: reportsByUser.get(id) ?? 0,
      stories: storiesByAuthor.get(id) ?? 0,
    }
  })
}

function buildTopHashtags(rows: Array<Record<string, unknown>>): SocialTopicSummary[] {
  const counts = new Map<string, number>()

  rows.forEach(row => {
    readArray(row.hashtags).forEach(value => {
      const tag = normalizeHashtag(readString(value))

      if (tag) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    })
  })

  return [...counts.entries()]
    .map(([tag, count]) => ({ count, tag }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 12)
}

function buildMusicSummaries(rows: Array<Record<string, unknown>>): SocialMusicSummary[] {
  return rows.map(row => {
    const issues: string[] = []

    if (!readString(row.title)) {
      issues.push('Missing title')
    }

    if (!readString(row.artist)) {
      issues.push('Missing artist')
    }

    if (!hasMedia(row.streamURL)) {
      issues.push('Missing audio stream')
    }

    if (!hasMedia(row.coverURL)) {
      issues.push('Missing cover')
    }

    return {
      artist: readString(row.artist) || 'Unknown artist',
      id: readString(row.id),
      isFeatured: isFeatured(row),
      issues,
      status: readStatus(row),
      title: readString(row.title) || 'Untitled song',
    }
  })
}

function buildItem(
  entity: AdminEntityConfig,
  row: Record<string, unknown>,
  reason: string,
): SocialModerationItem {
  return {
    author: readActorLabel(row),
    authorID: readString(row.authorID),
    commentsCount: readNumber(row.commentCount ?? row.commentsCount),
    createdAt: serializeDate(row.createdAt),
    engagementScore: readNumber(row.reactionsCount) + readNumber(row.commentCount ?? row.commentsCount),
    hashtags: readArray(row.hashtags).map(value => normalizeHashtag(readString(value))).filter(Boolean),
    id: readString(row.id) || readString(row._path) || readString(row._id),
    isFeatured: isFeatured(row),
    mediaCount: countMediaItems(row.postMedia ?? row.storyMediaURL ?? row.media ?? row.photo ?? row.photos),
    preview: readContentPreview(row),
    reason,
    reactionsCount: readNumber(row.reactionsCount),
    resource: entity.route,
    song: readSongLabel(row),
    status: readStatus(row),
    title: readTitle(entity, row),
  }
}

function readModerationReason(row: Record<string, unknown>) {
  const status = readStatus(row)

  if (/reported|flagged|pending|review|hidden|blocked|disabled|rejected|unsafe/i.test(status)) {
    return `Status: ${status}`
  }

  if (readBoolean(row.isHidden) || readBoolean(row.hidden)) {
    return 'Hidden content'
  }

  if (readBoolean(row.isReported) || readBoolean(row.reported) || readBoolean(row.flagged)) {
    return 'Reported content'
  }

  if (readBoolean(row.needsReview)) {
    return 'Needs review'
  }

  if (readBoolean(row.isApproved) === false || readBoolean(row.approved) === false) {
    return 'Waiting for approval'
  }

  return ''
}

function readContentIssueReason(route: string, row: Record<string, unknown>) {
  if (route === 'posts') {
    const hasText = Boolean(readString(row.postText) || readString(row.text) || readString(row.caption))
    const hasPostMedia = hasMedia(row.postMedia ?? row.media ?? row.photo ?? row.photos)

    if (!hasText && !hasPostMedia) {
      return 'Missing text and media'
    }

    return ''
  }

  if (route === 'stories') {
    if (!hasMedia(row.storyMediaURL ?? row.mediaURL ?? row.photoURL ?? row.url)) {
      return 'Missing story media'
    }

    return ''
  }

  if (route === 'comments' && !readString(row.commentText ?? row.text ?? row.body)) {
    return 'Empty comment'
  }

  return ''
}

function countByStatus(rows: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>()

  rows.forEach(row => {
    const status = readStatus(row)
    counts.set(status, (counts.get(status) ?? 0) + 1)
  })

  return [...counts.entries()]
    .map(([status, count]) => ({ count, status }))
    .sort((left, right) => right.count - left.count)
}

function serializeRow(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>,
  usePathId: boolean,
) {
  return {
    ...doc.data(),
    _id: doc.id,
    _path: doc.ref.path,
    id: usePathId ? doc.ref.path : doc.id,
  } as Record<string, unknown>
}

function emptyOverview(
  isEnabled: boolean,
  entities: ReturnType<typeof getSocialEntities>,
): SocialModerationOverview {
  return {
    creators: {
      highRisk: [],
      needingProfile: [],
      top: [],
    },
    curation: {
      candidates: [],
      featured: 0,
      topHashtags: [],
    },
    entities: serializeSocialEntities(entities),
    isEnabled,
    metrics: {
      comments: 0,
      contentIssues: 0,
      curationCandidates: 0,
      flaggedContent: 0,
      highRiskCreators: 0,
      hashtags: 0,
      musicIssues: 0,
      posts: 0,
      reports: 0,
      songs: 0,
      stories: 0,
      users: 0,
    },
    music: {
      readinessIssues: [],
      recent: [],
    },
    queues: {
      contentIssues: [],
      flaggedContent: [],
      reports: [],
    },
    statusCounts: {
      comments: [],
      posts: [],
      reports: [],
      stories: [],
    },
  }
}

function serializeSocialEntities(entities: ReturnType<typeof getSocialEntities>) {
  return {
    comments: entities.comments?.route,
    posts: entities.posts?.route,
    reports: entities.reports?.route,
    songs: entities.songs?.route,
    stories: entities.stories?.route,
    users: entities.users?.route,
  }
}

function findEntity(keys: string[]) {
  return adminPanelConfig.entities.find(entity => {
    return keys.includes(entity.key) || keys.includes(entity.route)
  })
}

function readTitle(entity: AdminEntityConfig, row: Record<string, unknown>) {
  const candidates = [
    row[entity.titleField],
    row.postText,
    row.commentText,
    row.caption,
    row.text,
    row.type,
    row.storyType,
    row.title,
    row.id,
  ]
  const value = candidates.map(readString).find(Boolean)

  if (value) {
    return value.length > 96 ? `${value.slice(0, 93)}...` : value
  }

  return entity.singularName
}

function readActorLabel(row: Record<string, unknown>) {
  return (
    readSnapshotName(row.author) ||
    readSnapshotName(row.user) ||
    readString(row.authorID) ||
    readString(row.source) ||
    readString(row.dest) ||
    'Unknown'
  )
}

function readContentPreview(row: Record<string, unknown>) {
  const value =
    readString(row.postText) ||
    readString(row.commentText) ||
    readString(row.caption) ||
    readString(row.text) ||
    readString(row.body)

  return value.length > 160 ? `${value.slice(0, 157)}...` : value
}

function readSongLabel(row: Record<string, unknown>) {
  const songSnapshot = row.song ?? row.sound ?? row.music

  if (songSnapshot && typeof songSnapshot === 'object' && !Array.isArray(songSnapshot)) {
    const record = songSnapshot as Record<string, unknown>
    return [readString(record.title), readString(record.artist)].filter(Boolean).join(' · ')
  }

  return (
    readString(row.songTitle) ||
    readString(row.soundTitle) ||
    readString(row.songID) ||
    readString(row.soundID)
  )
}

function readSnapshotName(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  const record = value as Record<string, unknown>
  const names = [
    readString(record.firstName),
    readString(record.lastName),
  ].filter(Boolean)

  return names.join(' ') || readString(record.email) || readString(record.username)
}

function readStatus(row: Record<string, unknown>) {
  const status =
    readString(row.moderationStatus) ||
    readString(row.status) ||
    readString(row.state) ||
    readString(row.approvalStatus) ||
    readString(row.visibility)

  if (status) {
    return status
  }

  if (isResolved(row)) {
    return 'resolved'
  }

  if (readBoolean(row.isHidden) || readBoolean(row.hidden)) {
    return 'hidden'
  }

  if (readBoolean(row.isApproved) === false || readBoolean(row.approved) === false) {
    return 'pending'
  }

  return 'active'
}

function isResolved(row: Record<string, unknown>) {
  return readBoolean(row.resolved) === true || /resolved|closed/i.test(readString(row.status))
}

function readBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string' && /^(true|false)$/i.test(value.trim())) {
    return value.trim().toLowerCase() === 'true'
  }

  return null
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readFirstString(value: unknown) {
  return readArray(value).map(readString).find(Boolean) ?? ''
}

function readString(value: unknown) {
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

function hasMedia(value: unknown) {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return Boolean(value)
}

function countMediaItems(value: unknown) {
  if (!value) {
    return 0
  }

  if (Array.isArray(value)) {
    return value.length
  }

  return hasMedia(value) ? 1 : 0
}

function isFeatured(row: Record<string, unknown>) {
  return readBoolean(row.isFeatured) === true || readBoolean(row.featured) === true
}

function countByField(rows: Array<Record<string, unknown>>, field: string) {
  const counts = new Map<string, number>()

  rows.forEach(row => {
    const value = readString(row[field])

    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  })

  return counts
}

function normalizeHashtag(value: string) {
  const normalized = value.trim().replace(/^#/, '').toLowerCase()
  return normalized ? `#${normalized}` : ''
}

function sortByCreatedAtDesc(left: SocialModerationItem, right: SocialModerationItem) {
  return readTime(right.createdAt) - readTime(left.createdAt)
}

function readTime(value: unknown) {
  const date = parseDate(value)
  return date?.getTime() ?? 0
}

function serializeDate(value: unknown) {
  return parseDate(value)?.toISOString()
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
