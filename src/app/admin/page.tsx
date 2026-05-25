'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ClipboardList,
  Database,
  ListChecks,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'
import { adminPanelConfig } from '@/generated/admin-panel.config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DashboardCardKind = 'activity' | 'audit' | 'business' | 'pending' | 'users'

interface DashboardCard {
  description: string
  href?: string
  kind: DashboardCardKind
  label: string
  value: number | string
}

interface EntityStat {
  access: string
  count: number
  label: string
  route: string
}

interface QueueStat {
  count: number
  label: string
  route: string
  type: string
}

interface DashboardStats {
  activeUsers: number
  cards: DashboardCard[]
  engagementRate: number
  entityStats: EntityStat[]
  monthNames: string[]
  queueStats: QueueStat[]
  recentActivity: Array<{
    channelId?: string
    content?: string
    timeAgo?: string
    type: string
    user?: string
  }>
  totalMessages: number
  totalUsers: number
  userGrowthData: number[]
  weeklyMessages: number[]
}

const cardIcons = {
  activity: Activity,
  audit: ClipboardList,
  business: Database,
  pending: ListChecks,
  users: Users,
} satisfies Record<DashboardCardKind, typeof Activity>

export default function Page() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function loadStats() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/dashboard/stats', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | (DashboardStats & { error?: string })
        | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to load dashboard stats.')
      }

      setStats(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load dashboard stats.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadStats()
  }, [])

  const cards = useMemo(() => {
    return stats?.cards.length
      ? stats.cards
      : [
          {
            description: 'All registered accounts.',
            href: '/admin/users',
            kind: 'users' as const,
            label: 'Total Users',
            value: stats?.totalUsers ?? 0,
          },
          {
            description: 'Users with recent activity signals.',
            href: '/admin/users',
            kind: 'activity' as const,
            label: 'Active Users',
            value: stats?.activeUsers ?? 0,
          },
          {
            description: 'Users with recent activity signals.',
            kind: 'activity' as const,
            label: 'Engagement',
            value: `${stats?.engagementRate ?? 0}%`,
          },
        ]
  }, [stats])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {adminPanelConfig.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {adminPanelConfig.mobileApp} · {adminPanelConfig.entities.length} entities ·{' '}
            {adminPanelConfig.features.length} features
          </p>
        </div>
        <Button
          disabled={isLoading}
          onClick={() => void loadStats()}
          size="icon"
          title="Refresh"
          type="button"
          variant="outline"
        >
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(card => (
          <MetricCard key={card.label} card={card} isLoading={isLoading && !stats} />
        ))}
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Business Collections</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {(stats?.entityStats ?? []).map(entity => (
                <Link
                  key={entity.route}
                  className="rounded-md border p-3 text-sm hover:bg-accent"
                  href={`/admin/${entity.route}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{entity.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {entity.access}
                      </div>
                    </div>
                    <div className="text-lg font-semibold">{entity.count}</div>
                  </div>
                </Link>
              ))}
              {!isLoading && (stats?.entityStats.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">
                  No writable business collections configured.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Work</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats?.queueStats ?? []).map(queue => (
                <Link
                  key={queue.route}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-accent"
                  href={`/admin/${queue.route}`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{queue.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {queue.type}
                    </div>
                  </div>
                  <Badge variant={queue.count > 0 ? 'default' : 'secondary'}>
                    {queue.count}
                  </Badge>
                </Link>
              ))}
              {!isLoading && (stats?.queueStats.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">
                  No moderation or operations queues detected yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats?.monthNames ?? []).map((month, index) => {
                const value = stats?.userGrowthData[index] ?? 0
                const max = Math.max(...(stats?.userGrowthData ?? [1]), 1)

                return (
                  <div
                    key={month}
                    className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 text-sm"
                  >
                    <span className="text-muted-foreground">{month}</span>
                    <div className="h-2 rounded bg-muted">
                      <div
                        className="h-2 rounded bg-primary"
                        style={{ width: Math.max(4, (value / max) * 100) + '%' }}
                      />
                    </div>
                    <span className="text-right">{value}</span>
                  </div>
                )
              })}
              {!isLoading && (stats?.monthNames.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No recent growth data.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats?.recentActivity ?? []).map((activity, index) => (
                <div key={index} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {activity.user ?? 'Unknown user'}
                      </div>
                      <div className="mt-1 line-clamp-2 text-muted-foreground">
                        {activity.content ?? activity.type}
                      </div>
                    </div>
                    <Badge variant="outline">{activity.type}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {activity.timeAgo ?? activity.channelId}
                  </div>
                </div>
              ))}
              {!isLoading && (stats?.recentActivity.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  card,
  isLoading,
}: {
  card: DashboardCard
  isLoading: boolean
}) {
  const Icon = cardIcons[card.kind]
  const content = (
    <Card className="h-full transition-colors hover:bg-accent/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">
          {isLoading ? '...' : card.value}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {card.description}
        </p>
      </CardContent>
    </Card>
  )

  return card.href ? <Link href={card.href}>{content}</Link> : content
}
