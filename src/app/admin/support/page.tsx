'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  LifeBuoy,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldOff,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface SupportUserSummary {
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

interface SupportTimelineEntry {
  createdAt?: string
  entity: string
  id: string
  route: string
  status: string
  title: string
}

interface SupportUserDetail {
  timeline: SupportTimelineEntry[]
  user: SupportUserSummary
}

export default function Page() {
  const [detail, setDetail] = useState<SupportUserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isSearching, setIsSearching] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<SupportUserSummary[]>([])

  async function searchUsers(nextQuery = query) {
    setError(null)
    setIsSearching(true)

    try {
      const params = new URLSearchParams({ limit: '20' })
      if (nextQuery.trim()) {
        params.set('q', nextQuery.trim())
      }

      const response = await fetch('/api/admin/support/users?' + params.toString(), {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; items?: SupportUserSummary[] }
        | null

      if (!response.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error ?? 'Failed to search users.')
      }

      setUsers(data.items)

      if (!detail && data.items[0]) {
        await loadUser(data.items[0].id)
      }
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : 'Failed to search users.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  async function loadUser(userId: string) {
    setError(null)
    setIsLoadingDetail(true)

    try {
      const response = await fetch(
        '/api/admin/support/users/' + encodeURIComponent(userId),
        {
          credentials: 'include',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | (SupportUserDetail & { error?: string })
        | null

      if (!response.ok || !data?.user) {
        throw new Error(data?.error ?? 'Failed to load user.')
      }

      setDetail(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load user.')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  async function runAction(action: 'disable_account' | 'enable_account' | 'reset_badge') {
    if (!detail?.user) {
      return
    }

    if (
      action !== 'reset_badge' &&
      !window.confirm('Apply this support action to the selected user?')
    ) {
      return
    }

    setError(null)
    setPendingAction(action)

    try {
      const response = await fetch(
        '/api/admin/support/users/' + encodeURIComponent(detail.user.id) + '/action',
        {
          body: JSON.stringify({ action }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { error?: string; user?: SupportUserSummary }
        | null

      if (!response.ok || !data?.user) {
        throw new Error(data?.error ?? 'Failed to apply support action.')
      }

      const updatedUser = data.user
      setDetail(current => current ? { ...current, user: updatedUser } : current)
      setUsers(current =>
        current.map(user => (user.id === updatedUser.id ? updatedUser : user)),
      )
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Failed to apply support action.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  useEffect(() => {
    void searchUsers('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void searchUsers()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Support Cockpit
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search users, inspect activity, and apply support actions.
            </p>
          </div>
        </div>
        <Button
          disabled={isSearching}
          onClick={() => void searchUsers()}
          size="icon"
          title="Refresh"
          type="button"
          variant="outline"
        >
          <RefreshCw className={isSearching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2" onSubmit={handleSearch}>
              <Input
                onChange={event => setQuery(event.target.value)}
                placeholder="Email, name, phone, user ID"
                value={query}
              />
              <Button disabled={isSearching} size="icon" type="submit">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </form>
            <div className="space-y-2">
              {users.map(user => (
                <button
                  key={user.id}
                  className="w-full rounded-md border p-3 text-left text-sm hover:bg-accent"
                  onClick={() => void loadUser(user.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{user.displayName}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {user.email || user.id}
                      </div>
                    </div>
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'active' : 'disabled'}
                    </Badge>
                  </div>
                </button>
              ))}
              {!isSearching && users.length === 0 && (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No users found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">User Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingDetail && (
                <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                  Loading user...
                </div>
              )}
              {!isLoadingDetail && !detail && (
                <div className="flex h-28 items-center justify-center rounded-md border text-sm text-muted-foreground">
                  Select a user.
                </div>
              )}
              {!isLoadingDetail && detail && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold">{detail.user.displayName}</div>
                      <div className="mt-1 truncate text-sm text-muted-foreground">
                        {detail.user.email || detail.user.id}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={detail.user.isActive ? 'default' : 'secondary'}>
                          {detail.user.isActive ? 'active' : 'disabled'}
                        </Badge>
                        {detail.user.role && <Badge variant="outline">{detail.user.role}</Badge>}
                        <Badge variant="outline">badge {detail.user.badgeCount}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={Boolean(pendingAction)}
                        onClick={() => void runAction('reset_badge')}
                        type="button"
                        variant="outline"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset Badge
                      </Button>
                      {detail.user.isActive ? (
                        <Button
                          disabled={Boolean(pendingAction)}
                          onClick={() => void runAction('disable_account')}
                          type="button"
                          variant="destructive"
                        >
                          <ShieldOff className="h-4 w-4" />
                          Disable
                        </Button>
                      ) : (
                        <Button
                          disabled={Boolean(pendingAction)}
                          onClick={() => void runAction('enable_account')}
                          type="button"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Enable
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <Info label="User ID" value={detail.user.id} />
                    <Info label="Phone" value={detail.user.phone || '-'} />
                    <Info label="Photo" value={detail.user.photoUrl || '-'} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(detail?.timeline ?? []).map(item => (
                  <Link
                    key={`${item.route}-${item.id}`}
                    className="block rounded-md border p-3 text-sm hover:bg-accent"
                    href={`/admin/${item.route}/${encodeURIComponent(item.id)}/view`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.entity} · {item.id}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {item.status && <Badge variant="outline">{item.status}</Badge>}
                        <Badge variant="secondary">{formatDate(item.createdAt)}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
                {detail && detail.timeline.length === 0 && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    No related timeline records found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-medium">{value}</div>
    </div>
  )
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'unknown'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
