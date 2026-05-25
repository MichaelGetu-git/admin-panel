'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, CircleDashed, Rocket, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type LaunchCheckStatus = 'ready' | 'warning' | 'blocked'

interface LaunchCheck {
  description: string
  href?: string
  id: string
  label: string
  status: LaunchCheckStatus
}

interface LaunchReadiness {
  blocked: number
  checks: LaunchCheck[]
  ready: number
  score: number
  total: number
  warning: number
}

const statusConfig = {
  blocked: {
    icon: XCircle,
    label: 'Blocked',
    tone: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  ready: {
    icon: CheckCircle2,
    label: 'Ready',
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Needs Review',
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  },
} satisfies Record<
  LaunchCheckStatus,
  {
    icon: typeof CheckCircle2
    label: string
    tone: string
  }
>

export default function Page() {
  const [readiness, setReadiness] = useState<LaunchReadiness | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function loadReadiness() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/launch/readiness', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | (LaunchReadiness & { error?: string })
        | null

      if (!response.ok || !data?.checks) {
        throw new Error(data?.error ?? 'Failed to load launch checklist.')
      }

      setReadiness(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load launch checklist.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadReadiness()
  }, [])

  const groupedChecks = useMemo(() => {
    const checks = readiness?.checks ?? []
    return {
      blocked: checks.filter(check => check.status === 'blocked'),
      ready: checks.filter(check => check.status === 'ready'),
      warning: checks.filter(check => check.status === 'warning'),
    }
  }, [readiness])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Launch Checklist
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Operational readiness before production access.
            </p>
          </div>
        </div>
        <Button disabled={isLoading} onClick={() => void loadReadiness()} variant="outline">
          {isLoading ? 'Checking...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="Launch Score" value={`${readiness?.score ?? 0}%`} />
        <StatusCard label="Ready" value={readiness?.ready ?? 0} />
        <StatusCard label="Needs Review" value={readiness?.warning ?? 0} />
        <StatusCard label="Blocked" value={readiness?.blocked ?? 0} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <CheckGroup checks={groupedChecks.blocked} status="blocked" />
        <CheckGroup checks={groupedChecks.warning} status="warning" />
        <CheckGroup checks={groupedChecks.ready} status="ready" />
      </div>
    </div>
  )
}

function StatusCard({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

function CheckGroup({
  checks,
  status,
}: {
  checks: LaunchCheck[]
  status: LaunchCheckStatus
}) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {config.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checks.map(check => (
            <div key={check.id} className={`rounded-md border p-3 ${config.tone}`}>
              <div className="font-medium">{check.label}</div>
              <p className="mt-1 text-sm opacity-90">{check.description}</p>
              {check.href && (
                <Link
                  className="mt-2 inline-flex text-sm font-medium underline-offset-4 hover:underline"
                  href={check.href}
                >
                  Open
                </Link>
              )}
            </div>
          ))}
          {checks.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
              <CircleDashed className="h-4 w-4" />
              Nothing in this group.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
