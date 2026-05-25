'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Flag,
  Hash,
  Loader2,
  Music2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SocialModerationItem {
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

interface SocialCreatorSummary {
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

interface SocialTopicSummary {
  count: number
  tag: string
}

interface SocialMusicSummary {
  artist: string
  id: string
  isFeatured: boolean
  issues: string[]
  status: string
  title: string
}

interface SocialModerationOverview {
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

type ModerationAction =
  | 'approve'
  | 'ban_author'
  | 'delete'
  | 'feature'
  | 'hide'
  | 'resolve'
  | 'show'
  | 'unban_author'
  | 'unfeature'

export default function Page() {
  const [actingKey, setActingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<SocialModerationOverview | null>(null)

  async function loadOverview() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/social-moderation/overview', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; overview?: SocialModerationOverview }
        | null

      if (!response.ok || !data?.overview) {
        throw new Error(data?.error ?? 'Failed to load moderation queue.')
      }

      setOverview(data.overview)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load moderation queue.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  async function applyAction(item: SocialModerationItem, action: ModerationAction) {
    if (
      action === 'delete' &&
      !window.confirm('Delete this moderation item permanently?')
    ) {
      return
    }

    const actionKey = `${item.resource}:${item.id}:${action}`
    setActingKey(actionKey)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/social-moderation/${encodeURIComponent(item.resource)}/${encodeURIComponent(item.id)}/${action}`,
        {
          credentials: 'include',
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to apply moderation action.')
      }

      await loadOverview()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Failed to apply moderation action.',
      )
    } finally {
      setActingKey(null)
    }
  }

  if (!overview && isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading moderation queue...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Social Moderation
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review reported posts, stories, comments and creator content before launch.
            </p>
          </div>
        </div>
        <Button disabled={isLoading} onClick={() => void loadOverview()} variant="outline">
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {overview && !overview.isEnabled && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Social Moderation is available when a panel has posts, comments or stories.
          </CardContent>
        </Card>
      )}

      {overview?.isEnabled && (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              helper={`${overview.metrics.posts} posts, ${overview.metrics.stories} stories`}
              icon={ShieldAlert}
              label="Content"
              value={overview.metrics.posts + overview.metrics.stories}
            />
            <MetricCard
              helper={`${overview.metrics.comments} comments scanned`}
              icon={Flag}
              label="Flagged"
              value={overview.metrics.flaggedContent}
            />
            <MetricCard
              helper={`${overview.metrics.highRiskCreators} creators with reports`}
              icon={AlertTriangle}
              label="Reports"
              value={overview.metrics.reports}
            />
            <MetricCard
              helper={`${overview.metrics.curationCandidates} candidates, ${overview.curation.featured} featured`}
              icon={TrendingUp}
              label="Curation"
              value={overview.metrics.curationCandidates}
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
            <div className="min-w-0 space-y-4">
              <ModerationQueue
                actingKey={actingKey}
                emptyText="No flagged content found in the current sample."
                items={overview.queues.flaggedContent}
                onAction={applyAction}
                title="Flagged Content"
                variant="content"
              />
              <ModerationQueue
                actingKey={actingKey}
                emptyText="No report documents found."
                items={overview.queues.reports}
                onAction={applyAction}
                title="Reports"
                variant="reports"
              />
            </div>

            <div className="min-w-0 space-y-4">
              <ModerationQueue
                actingKey={actingKey}
                emptyText="No content quality issues found."
                items={overview.queues.contentIssues}
                onAction={applyAction}
                title="Content Quality"
                variant="quality"
              />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4" />
                    Feed Curation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.curation.candidates.length === 0 && (
                    <div className="rounded-md border p-3 text-sm text-muted-foreground">
                      No curation candidates found.
                    </div>
                  )}
                  {overview.curation.candidates.slice(0, 5).map(item => (
                    <div className="rounded-md border p-3 text-sm" key={`${item.resource}:${item.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate font-medium">{item.title}</span>
                        <Badge variant="secondary">{item.engagementScore} engagement</Badge>
                      </div>
                      <div className="mt-1 text-muted-foreground">{item.author}</div>
                      <ItemInspector item={item} />
                      <div className="mt-3">
                        <ActionButtons
                          actingKey={actingKey}
                          item={item}
                          onAction={applyAction}
                          variant="quality"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <StatusList items={overview.statusCounts.posts} label="Posts" />
                  <StatusList items={overview.statusCounts.stories} label="Stories" />
                  <StatusList items={overview.statusCounts.comments} label="Comments" />
                  {overview.entities.reports && (
                    <StatusList items={overview.statusCounts.reports} label="Reports" />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserRound className="h-4 w-4" />
                  Creator Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.creators.highRisk.length === 0 && (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No high-risk creators found.
                  </div>
                )}
                {overview.creators.highRisk.slice(0, 6).map(creator => (
                  <CreatorRow creator={creator} key={creator.id} usersRoute={overview.entities.users} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Hash className="h-4 w-4" />
                  Topics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.curation.topHashtags.length === 0 && (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No hashtags found in sampled posts.
                  </div>
                )}
                {overview.curation.topHashtags.map(topic => (
                  <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm" key={topic.tag}>
                    <span className="truncate font-medium">{topic.tag}</span>
                    <Badge variant="secondary">{topic.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Music2 className="h-4 w-4" />
                  Music Readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!overview.entities.songs && (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    Music catalog is not configured for this panel.
                  </div>
                )}
                {overview.entities.songs && overview.music.readinessIssues.length === 0 && (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No music catalog issues found.
                  </div>
                )}
                {(overview.music.readinessIssues.length > 0
                  ? overview.music.readinessIssues
                  : overview.music.recent
                ).slice(0, 6).map(song => (
                  <div className="rounded-md border p-3 text-sm" key={song.id}>
                    <div className="truncate font-medium">{song.title}</div>
                    <div className="mt-1 text-muted-foreground">{song.artist}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={song.isFeatured ? 'default' : 'secondary'}>
                        {song.isFeatured ? 'featured' : song.status}
                      </Badge>
                      {song.issues.map(issue => (
                        <Badge key={issue} variant="secondary">{issue}</Badge>
                      ))}
                    </div>
                    <div className="mt-3">
                      <ActionButtons
                        actingKey={actingKey}
                        item={musicToModerationItem(song)}
                        onAction={applyAction}
                        variant="quality"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({
  helper,
  icon: Icon,
  label,
  value,
}: {
  helper: string
  icon: LucideIcon
  label: string
  value: number
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

function ModerationQueue({
  actingKey,
  emptyText,
  items,
  onAction,
  title,
  variant,
}: {
  actingKey: string | null
  emptyText: string
  items: SocialModerationItem[]
  onAction: (item: SocialModerationItem, action: ModerationAction) => Promise<void>
  title: string
  variant: 'content' | 'quality' | 'reports'
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant="secondary">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
        {items.map(item => (
          <div className="rounded-md border p-3" key={`${item.resource}:${item.id}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className="max-w-full truncate font-medium hover:underline"
                    href={`/admin/${item.resource}/${encodeURIComponent(item.id)}/view`}
                  >
                    {item.title}
                  </Link>
                  <Badge variant={badgeVariantForStatus(item.status)}>
                    {item.status}
                  </Badge>
                  {item.isFeatured && <Badge variant="outline">Featured</Badge>}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {item.reason} · {item.author}
                </div>
                {item.createdAt && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                )}
                <ItemInspector item={item} />
              </div>
              <ActionButtons
                actingKey={actingKey}
                item={item}
                onAction={onAction}
                variant={variant}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ItemInspector({ item }: { item: SocialModerationItem }) {
  const details = [
    `${item.reactionsCount} reactions`,
    `${item.commentsCount} comments`,
    `${item.mediaCount} media`,
  ]

  return (
    <div className="mt-2 space-y-2">
      {item.preview && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.preview}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {details.map(detail => (
          <Badge key={detail} variant="secondary">{detail}</Badge>
        ))}
        {item.song && <Badge variant="outline">{item.song}</Badge>}
        {item.hashtags.slice(0, 5).map(tag => (
          <Badge key={tag} variant="outline">{tag}</Badge>
        ))}
      </div>
    </div>
  )
}

function musicToModerationItem(song: SocialMusicSummary): SocialModerationItem {
  return {
    author: song.artist,
    authorID: '',
    commentsCount: 0,
    engagementScore: 0,
    hashtags: [],
    id: song.id,
    isFeatured: song.isFeatured,
    mediaCount: 0,
    preview: '',
    reason: song.issues.join(', ') || song.status,
    reactionsCount: 0,
    resource: 'songs',
    song: `${song.title} · ${song.artist}`,
    status: song.status,
    title: song.title,
  }
}

function ActionButtons({
  actingKey,
  item,
  onAction,
  variant,
}: {
  actingKey: string | null
  item: SocialModerationItem
  onAction: (item: SocialModerationItem, action: ModerationAction) => Promise<void>
  variant: 'content' | 'quality' | 'reports'
}) {
  const isActing = (action: ModerationAction) =>
    actingKey === `${item.resource}:${item.id}:${action}`

  if (variant === 'reports') {
    return (
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <Button
          disabled={Boolean(actingKey)}
          onClick={() => void onAction(item, 'resolve')}
          size="sm"
          variant="outline"
        >
          {isActing('resolve') ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Resolve
        </Button>
        <Button
          disabled={Boolean(actingKey)}
          onClick={() => void onAction(item, 'delete')}
          size="sm"
          variant="destructive"
        >
          {isActing('delete') ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2 sm:shrink-0">
      <Button
        disabled={Boolean(actingKey)}
        onClick={() => void onAction(item, item.status === 'hidden' ? 'show' : 'hide')}
        size="sm"
        variant="outline"
      >
        {isActing('hide') || isActing('show') ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : item.status === 'hidden' ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
        {item.status === 'hidden' ? 'Show' : 'Hide'}
      </Button>
      <Button
        disabled={Boolean(actingKey)}
        onClick={() => void onAction(item, 'approve')}
        size="sm"
        variant="outline"
      >
        {isActing('approve') ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Approve
      </Button>
      <Button
        disabled={Boolean(actingKey)}
        onClick={() => void onAction(item, item.isFeatured ? 'unfeature' : 'feature')}
        size="sm"
        variant="outline"
      >
        {isActing('feature') || isActing('unfeature') ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <TrendingUp className="h-4 w-4" />
        )}
        {item.isFeatured ? 'Unfeature' : 'Feature'}
      </Button>
      {item.authorID && (
        <Button
          disabled={Boolean(actingKey)}
          onClick={() => void onAction(item, 'ban_author')}
          size="sm"
          variant="destructive"
        >
          {isActing('ban_author') ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          Ban creator
        </Button>
      )}
    </div>
  )
}

function CreatorRow({
  creator,
  usersRoute,
}: {
  creator: SocialCreatorSummary
  usersRoute?: string
}) {
  return (
    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[3rem_minmax(0,1fr)]">
      <div className="h-12 w-12 overflow-hidden rounded-md border bg-muted">
        {creator.photo ? (
          <img alt="" className="h-full w-full object-cover" loading="lazy" src={creator.photo} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UserRound className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {usersRoute ? (
            <Link
              className="truncate font-medium hover:underline"
              href={`/admin/${usersRoute}/${encodeURIComponent(creator.id)}/view`}
            >
              {creator.name}
            </Link>
          ) : (
            <span className="truncate font-medium">{creator.name}</span>
          )}
          {creator.reports > 0 && <Badge variant="destructive">{creator.reports} reports</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{creator.posts} posts</span>
          <span>{creator.stories} stories</span>
          <span>{creator.reactions} reactions</span>
        </div>
        {creator.issues.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {creator.issues.map(issue => (
              <Badge key={issue} variant="secondary">{issue}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusList({
  items,
  label,
}: {
  items: Array<{ count: number; status: string }>
  label: string
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      {items.length === 0 && (
        <div className="text-sm text-muted-foreground">No statuses found.</div>
      )}
      {items.map(item => (
        <div className="flex items-center justify-between gap-3 text-sm" key={item.status}>
          <span className="truncate text-muted-foreground">{item.status}</span>
          <Badge variant="secondary">{item.count}</Badge>
        </div>
      ))}
    </div>
  )
}

function badgeVariantForStatus(status: string) {
  if (/hidden|blocked|disabled|rejected|unsafe|reported|flagged/i.test(status)) {
    return 'destructive'
  }

  if (/approved|active|resolved/i.test(status)) {
    return 'default'
  }

  return 'secondary'
}
