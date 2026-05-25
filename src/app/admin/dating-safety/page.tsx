'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Heart,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldOff,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DatingReportSummary {
  dest: string
  id: string
  source: string
  type: string
  user: string
}

interface DatingUserSafetySummary {
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

interface DatingSafetyOverview {
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

export default function Page() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<DatingSafetyOverview | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  async function loadOverview() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/dating-safety/overview', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; overview?: DatingSafetyOverview }
        | null

      if (!response.ok || !data?.overview) {
        throw new Error(data?.error ?? 'Failed to load dating safety.')
      }

      setOverview(data.overview)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load dating safety.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  async function runAction(resource: string, id: string, action: string) {
    setUpdatingKey(`${resource}:${id}:${action}`)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/dating-safety/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/action`,
        {
          body: JSON.stringify({ action }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to run dating safety action.')
      }

      await loadOverview()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Failed to run dating safety action.',
      )
    } finally {
      setUpdatingKey(null)
    }
  }

  if (!overview && isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading dating safety...
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
              Dating Safety Center
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reports, hidden profiles, recommendation health and swipe limits.
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
            Dating Safety Center is available for the dating panel.
          </CardContent>
        </Card>
      )}

      {overview?.isEnabled && (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              helper={`${overview.verification.verified} verified profiles`}
              icon={Users}
              label="Users"
              value={overview.users.total}
            />
            <MetricCard
              helper={`${overview.reports.pairs} blocked pairs`}
              icon={ShieldAlert}
              label="Reports"
              value={overview.reports.total}
            />
            <MetricCard
              helper={`${overview.matches.unseen} unseen matches`}
              icon={Heart}
              label="Matches"
              value={overview.matches.total}
            />
            <MetricCard
              helper={`${overview.recommendations.notComputed} users not computed`}
              icon={Sparkles}
              label="Recommendations"
              value={overview.recommendations.total}
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.85fr)]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Report Queue</CardTitle>
                {overview.entities.reports && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/${overview.entities.reports}`}>Open Reports</Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.reports.recent.length === 0 && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    No dating reports found.
                  </div>
                )}
                {overview.reports.recent.map(report => (
                  <div className="rounded-md border p-3" key={report.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {overview.entities.reports ? (
                            <Link
                              className="truncate font-medium hover:underline"
                              href={`/admin/${overview.entities.reports}/${encodeURIComponent(report.id)}/view`}
                            >
                              {report.user}
                            </Link>
                          ) : (
                            <span className="truncate font-medium">{report.user}</span>
                          )}
                          <Badge variant="destructive">{report.type}</Badge>
                        </div>
                        <div className="mt-1 truncate text-sm text-muted-foreground">
                          {report.source}
                          {' -> '}
                          {report.dest}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:shrink-0">
                        <ActionButton
                          action="unblock_pair"
                          icon={ShieldOff}
                          label="Unblock"
                          onRun={() => runAction('reports', report.id, 'unblock_pair')}
                          updatingKey={updatingKey}
                          updateKey={`reports:${report.id}:unblock_pair`}
                          variant="outline"
                        />
                        <ActionButton
                          action="delete_report"
                          icon={Trash2}
                          label="Delete"
                          onRun={() => runAction('reports', report.id, 'delete_report')}
                          updatingKey={updatingKey}
                          updateKey={`reports:${report.id}:delete_report`}
                          variant="destructive"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Onboarding Readiness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ReadinessRow count={overview.users.incomplete} label="Incomplete profiles" />
                  <ReadinessRow count={overview.users.missingPhotos} label="Missing profile photos" />
                  <ReadinessRow count={overview.users.missingLocation} label="Missing location" />
                  <ReadinessRow count={overview.geo.missingPreferences} label="Missing discovery preferences" />
                  <ReadinessRow count={overview.recommendations.notComputed} label="Recommendations not computed" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SmallStat label="Verified" value={overview.verification.verified} />
                  <SmallStat label="Unverified" value={overview.verification.unverified} />
                  <SmallStat label="Ready to verify" value={overview.verification.queue.length} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Swipe Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SmallStat label="Swipe counters" value={overview.swipeCounts.total} />
                  <SmallStat label="Total swipes" value={overview.swipes.total} />
                  {overview.swipes.byType.map(item => (
                    <SmallStat key={item.type} label={formatLabel(item.type)} value={item.count} />
                  ))}
                  {overview.entities.swipes && (
                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/admin/${overview.entities.swipes}`}>Open Swipes</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SmallStat label="Subscriptions" value={overview.subscriptions.total} />
                  <SmallStat label="Active signals" value={overview.subscriptions.active} />
                  <SmallStat label="Active rate %" value={overview.subscriptions.activeRate} />
                  {overview.entities.subscriptions && (
                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/admin/${overview.entities.subscriptions}`}>Open Subscriptions</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <UserQueue
              emptyText="No reported users found."
              entities={overview.entities}
              onRunAction={runAction}
              title="Reported Users"
              updatingKey={updatingKey}
              users={overview.users.reported}
            />
            <UserQueue
              emptyText="No profile quality issues found."
              entities={overview.entities}
              onRunAction={runAction}
              title="Profile Quality"
              updatingKey={updatingKey}
              users={overview.users.qualityIssues}
            />
            <UserQueue
              emptyText="No users are ready for verification."
              entities={overview.entities}
              onRunAction={runAction}
              title="Verification Queue"
              updatingKey={updatingKey}
              users={overview.verification.queue}
            />
          </div>
        </>
      )}
    </div>
  )
}

function UserQueue({
  emptyText,
  entities,
  onRunAction,
  title,
  updatingKey,
  users,
}: {
  emptyText: string
  entities: DatingSafetyOverview['entities']
  onRunAction: (resource: string, id: string, action: string) => Promise<void>
  title: string
  updatingKey: string | null
  users: DatingUserSafetySummary[]
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {entities.users && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/${entities.users}`}>Open Users</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {users.length === 0 && (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
        {users.map(user => (
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[3.5rem_minmax(0,1fr)]" key={user.id}>
            <div className="h-14 w-14 overflow-hidden rounded-md border bg-muted">
              {user.photo ? (
                <img alt="" className="h-full w-full object-cover" loading="lazy" src={user.photo} />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {entities.users ? (
                    <Link
                      className="truncate font-medium hover:underline"
                      href={`/admin/${entities.users}/${encodeURIComponent(user.id)}/view`}
                    >
                      {user.name}
                    </Link>
                  ) : (
                    <span className="truncate font-medium">{user.name}</span>
                  )}
                  <Badge variant={user.isHidden ? 'destructive' : 'secondary'}>
                    {user.isHidden ? 'Hidden' : `${user.profileScore}% ready`}
                  </Badge>
                  {user.isVerified && <Badge variant="outline">Verified</Badge>}
                  {user.reports > 0 && <Badge variant="destructive">{user.reports} reports</Badge>}
                </div>
                <div className="mt-1 truncate text-sm text-muted-foreground">
                  {user.email || user.id}
                </div>
                {user.issues.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {user.issues.map(issue => (
                      <Badge key={issue} variant="secondary">
                        {issue}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  action={user.isHidden ? 'show_user' : 'hide_user'}
                  icon={user.isHidden ? Eye : EyeOff}
                  label={user.isHidden ? 'Show' : 'Hide'}
                  onRun={() => onRunAction('users', user.id, user.isHidden ? 'show_user' : 'hide_user')}
                  updatingKey={updatingKey}
                  updateKey={`users:${user.id}:${user.isHidden ? 'show_user' : 'hide_user'}`}
                  variant={user.isHidden ? 'outline' : 'destructive'}
                />
                <ActionButton
                  action="recompute_recommendations"
                  icon={Sparkles}
                  label="Recompute"
                  onRun={() => onRunAction('users', user.id, 'recompute_recommendations')}
                  updatingKey={updatingKey}
                  updateKey={`users:${user.id}:recompute_recommendations`}
                  variant="outline"
                />
                <ActionButton
                  action="reset_swipe_count"
                  icon={RotateCcw}
                  label="Reset swipes"
                  onRun={() => onRunAction('users', user.id, 'reset_swipe_count')}
                  updatingKey={updatingKey}
                  updateKey={`users:${user.id}:reset_swipe_count`}
                  variant="outline"
                />
                <ActionButton
                  action={user.isVerified ? 'unverify_user' : 'verify_user'}
                  icon={ShieldCheck}
                  label={user.isVerified ? 'Unverify' : 'Verify'}
                  onRun={() => onRunAction('users', user.id, user.isVerified ? 'unverify_user' : 'verify_user')}
                  updatingKey={updatingKey}
                  updateKey={`users:${user.id}:${user.isVerified ? 'unverify_user' : 'verify_user'}`}
                  variant="outline"
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onRun,
  updateKey,
  updatingKey,
  variant,
}: {
  action: string
  icon: LucideIcon
  label: string
  onRun: () => Promise<void>
  updateKey: string
  updatingKey: string | null
  variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}) {
  const isRunning = updatingKey === updateKey

  return (
    <Button disabled={Boolean(updatingKey)} onClick={() => void onRun()} size="sm" variant={variant}>
      {isRunning ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {label}
    </Button>
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

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function ReadinessRow({ count, label }: { count: number; label: string }) {
  const isReady = count === 0

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {isReady ? (
          <MapPin className="h-4 w-4 text-primary" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        )}
        <span className="truncate">{label}</span>
      </div>
      <Badge variant={isReady ? 'default' : 'destructive'}>{count}</Badge>
    </div>
  )
}

function formatLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
