'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface AuditLogEntry {
  action: string
  actorEmail: string
  actorRole: string
  actorUid: string
  createdAt?: string
  id: string
  metadata: Record<string, unknown>
  resourceId: string
  resourcePath: string
  resourceType: string
}

export default function Page() {
  const [items, setItems] = useState<AuditLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function loadAuditLog() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/audit-log?limit=100', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; items?: AuditLogEntry[] }
        | null

      if (!response.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error ?? 'Failed to load audit log.')
      }

      setItems(data.items)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load audit log.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAuditLog()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Audit Log
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent admin actions across this panel.
            </p>
          </div>
        </div>
        <Button disabled={isLoading} onClick={() => void loadAuditLog()} variant="outline">
          <RefreshCw className="h-4 w-4" />
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-36">Time</TableHead>
                <TableHead className="min-w-44">Action</TableHead>
                <TableHead className="min-w-44">Resource</TableHead>
                <TableHead className="min-w-44">Admin</TableHead>
                <TableHead className="min-w-60">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-56 truncate font-medium">
                      {item.resourcePath || item.resourceId || item.resourceType}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.resourceType}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-56 truncate">
                      {item.actorEmail || item.actorUid || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.actorRole || 'admin'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="line-clamp-2 block max-w-xl whitespace-pre-wrap break-words rounded-md bg-muted px-2 py-1 text-xs">
                      {formatMetadata(item.metadata)}
                    </code>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground" colSpan={5}>
                    No audit events yet.
                  </TableCell>
                </TableRow>
              )}
              {isLoading && (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground" colSpan={5}>
                    Loading audit log...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Pending'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatMetadata(metadata: Record<string, unknown>) {
  if (Object.keys(metadata).length === 0) {
    return '{}'
  }

  return JSON.stringify(metadata, null, 2)
}
