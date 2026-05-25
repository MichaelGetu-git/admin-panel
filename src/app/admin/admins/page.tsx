'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Crown, RefreshCw, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type AdminRole = 'owner' | 'operator' | 'support' | 'moderator' | 'content_manager'

interface AdminRoleEntry {
  createdAt?: string
  disabled: boolean
  displayName: string
  email: string
  emailVerified: boolean
  lastSignInAt?: string
  role: AdminRole
  source: string
  uid: string
  updatedAt?: string
}

const roleOptions: AdminRole[] = [
  'owner',
  'operator',
  'support',
  'moderator',
  'content_manager',
]

const roleLabels = {
  content_manager: 'Content manager',
  moderator: 'Moderator',
  operator: 'Operator',
  owner: 'Owner',
  support: 'Support',
} satisfies Record<AdminRole, string>

export default function Page() {
  const [admins, setAdmins] = useState<AdminRoleEntry[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [role, setRole] = useState<AdminRole>('operator')

  async function loadAdmins() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/admins', { credentials: 'include' })
      const data = (await response.json().catch(() => null)) as
        | { admins?: AdminRoleEntry[]; error?: string }
        | null

      if (!response.ok || !Array.isArray(data?.admins)) {
        throw new Error(data?.error ?? 'Failed to load admin users.')
      }

      setAdmins(data.admins)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load admin users.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAdmins()
  }, [])

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      const response = await fetch('/api/admin/admins', {
        body: JSON.stringify({ email, role }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const data = (await response.json().catch(() => null)) as
        | { admin?: AdminRoleEntry; error?: string }
        | null

      if (!response.ok || !data?.admin) {
        throw new Error(data?.error ?? 'Failed to add admin user.')
      }

      setEmail('')
      setRole('operator')
      await loadAdmins()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to add admin user.')
    } finally {
      setIsSaving(false)
    }
  }

  async function updateRole(uid: string, nextRole: AdminRole) {
    setError(null)

    try {
      const response = await fetch(`/api/admin/admins/${encodeURIComponent(uid)}`, {
        body: JSON.stringify({ role: nextRole }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      })
      const data = (await response.json().catch(() => null)) as
        | { admin?: AdminRoleEntry; error?: string }
        | null

      if (!response.ok || !data?.admin) {
        throw new Error(data?.error ?? 'Failed to update admin role.')
      }

      setAdmins(current =>
        current.map(admin => (admin.uid === uid ? { ...admin, role: nextRole } : admin)),
      )
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to update admin role.',
      )
      await loadAdmins()
    }
  }

  async function removeAdmin(uid: string) {
    if (!window.confirm('Remove admin access for this user?')) {
      return
    }

    setError(null)

    try {
      const response = await fetch(`/api/admin/admins/${encodeURIComponent(uid)}`, {
        credentials: 'include',
        method: 'DELETE',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; ok?: boolean }
        | null

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Failed to remove admin access.')
      }

      setAdmins(current => current.filter(admin => admin.uid !== uid))
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Failed to remove admin access.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Admin Roles
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage Firebase custom claims for operational admin access.
            </p>
          </div>
        </div>
        <Button disabled={isLoading} onClick={() => void loadAdmins()} variant="outline">
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Add Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_14rem_auto]" onSubmit={createAdmin}>
            <Input
              autoComplete="email"
              onChange={event => setEmail(event.target.value)}
              placeholder="admin@example.com"
              type="email"
              value={email}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              onChange={event => setRole(event.target.value as AdminRole)}
              value={role}
            >
              {roleOptions.map(option => (
                <option key={option} value={option}>
                  {roleLabels[option]}
                </option>
              ))}
            </select>
            <Button disabled={isSaving || !email.trim()} type="submit">
              <UserPlus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {admins.map(admin => (
          <Card key={admin.uid}>
            <CardContent className="grid min-w-0 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate font-medium">
                    {admin.email || admin.uid}
                  </div>
                  {admin.role === 'owner' && (
                    <Badge>
                      <Crown className="h-3 w-3" />
                      Owner
                    </Badge>
                  )}
                  {admin.disabled && <Badge variant="destructive">Disabled</Badge>}
                  {!admin.emailVerified && admin.email && (
                    <Badge variant="secondary">Unverified</Badge>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {admin.displayName || admin.uid}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Source: {admin.source}
                </div>
              </div>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                onChange={event => void updateRole(admin.uid, event.target.value as AdminRole)}
                value={admin.role}
              >
                {roleOptions.map(option => (
                  <option key={option} value={option}>
                    {roleLabels[option]}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => void removeAdmin(admin.uid)}
                type="button"
                variant="outline"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}
        {!isLoading && admins.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No admin users found.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
