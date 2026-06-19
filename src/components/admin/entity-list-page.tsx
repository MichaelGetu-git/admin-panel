'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  adminPanelConfig,
  type AdminActionConfig,
  type AdminEntityConfig,
} from '@/generated/admin-panel.config'
import { canWriteEntity } from '@/lib/admin-permissions'
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
import { DatingModerationActions } from '@/components/admin/dating-moderation-actions'

interface EntityListPageProps {
  adminRole: string
  entity: AdminEntityConfig
}

type FieldMap = AdminEntityConfig['fields']
type FieldConfig = FieldMap extends Record<string, infer Field> ? Field : never
type RecordValue = Record<string, unknown> & { id?: string }
type BulkAction = {
  apiAction: 'delete' | 'setField'
  confirm?: boolean
  field?: string
  icon: LucideIcon
  id: string
  label: string
  value?: unknown
  variant?: 'default' | 'destructive' | 'outline'
}

export function EntityListPage({ adminRole, entity }: EntityListPageProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [records, setRecords] = useState<RecordValue[]>([])
  const [error, setError] = useState<string | null>(null)
  const [bulkActionId, setBulkActionId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const canWrite = canWriteEntity(adminRole, entity)

  const fields = useMemo(() => {
    const fieldMap = entity.fields as Record<string, FieldConfig>

    return entity.listFields
      .map(fieldKey => ({
        key: fieldKey,
        field: fieldMap[fieldKey],
      }))
      .filter(
        (item): item is { key: string; field: FieldConfig } => Boolean(item.field),
      )
  }, [entity.fields, entity.listFields])

  const loadedRecordIds = useMemo(
    () => records.map(record => String(record.id ?? '')).filter(Boolean),
    [records],
  )
  const allLoadedSelected =
    loadedRecordIds.length > 0 && loadedRecordIds.every(id => selectedIds.has(id))
  const bulkActions = useMemo(() => (canWrite ? getBulkActions(entity) : []), [canWrite, entity])

  useEffect(() => {
    setSelectedIds(current => {
      const next = new Set([...current].filter(id => loadedRecordIds.includes(id)))
      return next.size === current.size ? current : next
    })
  }, [loadedRecordIds])

  const loadRecords = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setNotice(null)

    const params = new URLSearchParams({ limit: '50' })
    if (entity.orderBy) {
      params.set('orderBy', entity.orderBy.field)
      params.set('direction', entity.orderBy.direction)
    }

    try {
      const response = await fetch('/api/admin/' + entity.route + '?' + params.toString(), {
        credentials: 'include',
      })

      if (response.status === 401) {
        router.replace('/login')
        return
      }

      const data = (await response.json().catch(() => null)) as {
        items?: RecordValue[]
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to load records.')
      }

      setRecords(data?.items ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load records.')
    } finally {
      setIsLoading(false)
    }
  }, [entity.orderBy, entity.route, router])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  async function deleteRecord(recordId: string) {
    if (!canWrite) {
      return
    }

    if (!window.confirm('Delete this record?')) {
      return
    }

    setDeletingId(recordId)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch(
        '/api/admin/' + entity.route + '/' + encodeURIComponent(recordId),
        {
          method: 'DELETE',
          credentials: 'include',
        },
      )
      const data = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to delete record.')
      }

      setRecords(current => current.filter(record => String(record.id) !== recordId))
      router.refresh()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete record.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  async function exportRecords() {
    setIsExporting(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/admin/' + entity.route + '/export?limit=1000', {
        credentials: 'include',
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Failed to export records.')
      }

      const blob = await response.blob()
      const fileName = readDownloadFileName(response) ?? `${entity.route}.csv`
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : 'Failed to export records.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  async function importCsv(file: File | null) {
    if (!canWrite) {
      return
    }

    if (!file) {
      return
    }

    setIsImporting(true)
    setError(null)
    setNotice(null)

    try {
      const csv = await file.text()
      const response = await fetch('/api/admin/' + entity.route + '/import', {
        body: csv,
        credentials: 'include',
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        method: 'POST',
      })
      const data = (await response.json().catch(() => null)) as
        | {
            created?: number
            error?: string
            errors?: Array<{ message: string; row: number }>
            skipped?: number
            updated?: number
          }
        | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to import CSV.')
      }

      const rowErrors = data?.errors?.length
        ? ` ${data.errors.length} row errors were skipped.`
        : ''
      await loadRecords()
      setNotice(
        `Imported ${data?.created ?? 0} new and ${data?.updated ?? 0} updated records.${rowErrors}`,
      )
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : 'Failed to import CSV.',
      )
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function runBulkAction(action: BulkAction) {
    if (!canWrite) {
      return
    }

    const ids = [...selectedIds]

    if (ids.length === 0) {
      return
    }

    if (
      action.confirm &&
      !window.confirm(`Delete ${ids.length} selected records?`)
    ) {
      return
    }

    setBulkActionId(action.id)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/admin/' + entity.route + '/bulk', {
        body: JSON.stringify(
          action.apiAction === 'delete'
            ? { action: 'delete', actionId: action.id, ids }
            : {
                action: 'setField',
                actionId: action.id,
                field: action.field,
                ids,
                value: action.value,
              },
        ),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const data = (await response.json().catch(() => null)) as
        | { count?: number; error?: string }
        | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Bulk action failed.')
      }

      setSelectedIds(new Set())
      await loadRecords()
      setNotice(`${action.label} applied to ${data?.count ?? ids.length} records.`)
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Bulk action failed.')
    } finally {
      setBulkActionId(null)
    }
  }

  function toggleSelected(recordId: string, isSelected: boolean) {
    setSelectedIds(current => {
      const next = new Set(current)
      if (isSelected) {
        next.add(recordId)
      } else {
        next.delete(recordId)
      }
      return next
    })
  }

  function toggleAllLoaded(isSelected: boolean) {
    setSelectedIds(current => {
      const next = new Set(current)
      loadedRecordIds.forEach(id => {
        if (isSelected) {
          next.add(id)
        } else {
          next.delete(id)
        }
      })
      return next
    })
  }

  function recordActions(recordId: string, record: RecordValue) {
    const encodedRecordId = encodeURIComponent(recordId)
    // Chats use a custom bubble view at /admin/channels/{id} — skip the generic /view
    const viewHref =
      entity.key === 'channels'
        ? '/admin/' + entity.route + '/' + encodedRecordId
        : '/admin/' + entity.route + '/' + encodedRecordId + '/view'

    return (
      <div className="flex shrink-0 justify-end gap-1">
        {canWrite && (
          <DatingModerationActions
            compact
            entity={entity}
            record={record}
            onCompleted={() => void loadRecords()}
          />
        )}
        <Button asChild size="icon" variant="ghost" title="View">
          <Link href={viewHref}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
        {canWrite && (
          <>
            <Button asChild size="icon" variant="ghost" title="Edit">
              <Link href={'/admin/' + entity.route + '/' + encodedRecordId + '/update'}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Delete"
              type="button"
              onClick={() => void deleteRecord(recordId)}
              disabled={deletingId === recordId}
            >
              {deletingId === recordId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {entity.displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{entity.collection}</Badge>
            <Badge variant={entity.access === 'readOnly' ? 'outline' : 'default'}>
              {entity.access}
            </Badge>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {canWrite && (
            <>
              <input
                ref={fileInputRef}
                accept=".csv,text/csv"
                className="hidden"
                type="file"
                onChange={event => void importCsv(event.target.files?.[0] ?? null)}
              />
              <Button
                className="shrink-0"
                size="icon"
                variant="outline"
                title="Import CSV"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
          <Button
            className="shrink-0"
            size="icon"
            variant="outline"
            title="Export CSV"
            type="button"
            onClick={() => void exportRecords()}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
          <Button
            className="shrink-0"
            size="icon"
            variant="outline"
            title="Refresh"
            type="button"
            onClick={() => void loadRecords()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          {canWrite && (
            <Button asChild className="flex-1 sm:flex-none">
              <Link href={'/admin/' + entity.route + '/add'}>
                <Plus className="mr-2 h-4 w-4" />
                Add New
              </Link>
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {canWrite && selectedIds.size > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </div>
            <div className="flex flex-wrap gap-2">
              {bulkActions.map(action => {
                const Icon = action.icon

                return (
                  <Button
                    className="gap-2"
                    key={action.id}
                    size="sm"
                    type="button"
                    variant={action.variant ?? 'outline'}
                    onClick={() => void runBulkAction(action)}
                    disabled={Boolean(bulkActionId)}
                  >
                    {bulkActionId === action.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    {action.label}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {entity.displayName}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {records.length} loaded
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 md:hidden">
          {isLoading && (
            <div className="flex h-24 items-center justify-center rounded-md border text-sm text-muted-foreground">
              Loading records...
            </div>
          )}
          {!isLoading && error && (
            <div className="flex h-24 items-center justify-center rounded-md border text-sm text-destructive">
              {error}
            </div>
          )}
          {!isLoading && !error && records.length === 0 && (
            <div className="flex h-24 items-center justify-center rounded-md border text-sm text-muted-foreground">
              No records found.
            </div>
          )}
          {!isLoading && !error && records.map(record => {
            const recordId = String(record.id ?? '')

            return (
              <div key={recordId} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {canWrite && (
                      <input
                        aria-label={`Select ${recordId}`}
                        checked={selectedIds.has(recordId)}
                        className="mt-1 h-4 w-4 rounded border-input"
                        type="checkbox"
                        onChange={event => toggleSelected(recordId, event.target.checked)}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {formatRecordTitle(record, entity.titleField)}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {recordId}
                      </div>
                    </div>
                  </div>
                  {recordActions(recordId, record)}
                </div>
                <dl className="mt-3 space-y-2">
                  {fields.map(({ key, field }) => (
                    <div key={key} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 text-sm">
                      <dt className="truncate text-muted-foreground">{field.label}</dt>
                      <dd className="min-w-0">{formatCellValue(record[key], field, key)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
        </CardContent>
        <CardContent className="hidden overflow-x-auto md:block">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                {canWrite && (
                  <TableHead className="w-10">
                    <input
                      aria-label="Select all loaded records"
                      checked={allLoadedSelected}
                      className="h-4 w-4 rounded border-input"
                      type="checkbox"
                      onChange={event => toggleAllLoaded(event.target.checked)}
                    />
                  </TableHead>
                )}
                {fields.map(({ key, field }) => (
                  <TableHead key={key}>{field.label}</TableHead>
                ))}
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={fields.length + (canWrite ? 2 : 1)}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    Loading records...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && error && (
                <TableRow>
                  <TableCell
                    colSpan={fields.length + (canWrite ? 2 : 1)}
                    className="h-24 text-center text-sm text-destructive"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={fields.length + (canWrite ? 2 : 1)}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No records found.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && records.map(record => {
                const recordId = String(record.id ?? '')

                return (
                  <TableRow key={recordId}>
                    {canWrite && (
                      <TableCell>
                        <input
                          aria-label={`Select ${recordId}`}
                          checked={selectedIds.has(recordId)}
                          className="h-4 w-4 rounded border-input"
                          type="checkbox"
                          onChange={event =>
                            toggleSelected(recordId, event.target.checked)
                          }
                        />
                      </TableCell>
                    )}
                    {fields.map(({ key, field }) => (
                      <TableCell key={key} className="max-w-64">
                        {formatCellValue(record[key], field, key)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {recordActions(recordId, record)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function getBulkActions(entity: AdminEntityConfig): BulkAction[] {
  if (entity.access === 'readOnly') {
    return []
  }

  return adminPanelConfig.actions
    .filter(action => isEntityBulkAction(action, entity))
    .map(action => toBulkAction(action))
    .filter((action): action is BulkAction => Boolean(action))
}

function isEntityBulkAction(action: AdminActionConfig, entity: AdminEntityConfig) {
  const targetsEntity = action.entity === entity.key || action.entity === entity.route

  if (!targetsEntity) {
    return false
  }

  if (action.type === 'setField') {
    return Boolean(action.field && entity.fields[action.field])
  }

  return action.type === 'bulk' && action.operation === 'delete'
}

function toBulkAction(action: AdminActionConfig): BulkAction | null {
  if (action.type === 'setField' && action.field) {
    return {
      apiAction: 'setField',
      field: action.field,
      icon: getBulkActionIcon(action),
      id: action.id,
      label: action.label,
      value: action.value,
      variant: getBulkActionVariant(action),
    }
  }

  if (action.type === 'bulk' && action.operation === 'delete') {
    return {
      apiAction: 'delete',
      confirm: action.confirm,
      icon: Trash2,
      id: action.id,
      label: action.label,
      variant: 'destructive',
    }
  }

  return null
}

function getBulkActionIcon(action: AdminActionConfig) {
  const key = `${action.id} ${action.label} ${action.field ?? ''}`.toLowerCase()

  if (key.includes('hide')) {
    return EyeOff
  }

  if (key.includes('show')) {
    return Eye
  }

  if (key.includes('feature')) {
    return Star
  }

  if (key.includes('disable')) {
    return XCircle
  }

  return CheckCircle2
}

function getBulkActionVariant(action: AdminActionConfig): BulkAction['variant'] {
  const key = `${action.id} ${action.label}`.toLowerCase()
  return key.includes('disable') || key.includes('hide') ? 'outline' : 'default'
}

function formatRecordTitle(record: RecordValue, titleField: string) {
  const value = record[titleField] ?? record.name ?? record.title ?? record.email ?? record.id
  if (value === null || value === undefined || value === '') {
    return 'Untitled record'
  }

  return truncate(String(value), 80)
}

function formatCellValue(value: unknown, field: FieldConfig, key: string): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">-</span>
  }

  if (field.type === 'photo' || field.type === 'media') {
    const url = mediaUrlFromValue(value)

    if (!url) {
      return (
        <code className="block truncate rounded bg-muted px-2 py-1 text-xs">
          {JSON.stringify(value)}
        </code>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <SafeImage className="h-9 w-9 rounded-md border object-cover" url={url} />
        <span className="truncate text-xs text-muted-foreground">{url}</span>
      </div>
    )
  }

  if (isTimestampField(key)) {
    const date = dateFromTimestampLike(value)
    return date ? date.toLocaleString() : String(value)
  }

  if (field.type === 'boolean') {
    return (
      <Badge variant={value === true ? 'default' : 'secondary'}>
        {value === true ? 'true' : 'false'}
      </Badge>
    )
  }

  if (field.type === 'date') {
    const date = dateFromTimestampLike(value)
    return date ? date.toLocaleString() : String(value)
  }

  if (Array.isArray(value)) {
    return <span>{value.length} items</span>
  }

  if (typeof value === 'object') {
    return (
      <code className="block truncate rounded bg-muted px-2 py-1 text-xs">
        {JSON.stringify(value)}
      </code>
    )
  }

  return <span className="block truncate">{truncate(String(value), 96)}</span>
}

function isTimestampField(key: string) {
  return key === 'createdAt' || key === 'updatedAt' || key === 'lastOnlineTimestamp'
}

function dateFromTimestampLike(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const date = new Date(value < 100000000000 ? value * 1000 : value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{10}$/.test(trimmed)) {
      return dateFromTimestampLike(Number(trimmed))
    }
    if (/^\d{13}$/.test(trimmed)) {
      return dateFromTimestampLike(Number(trimmed))
    }

    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (value && typeof value === 'object') {
    const record = value as { seconds?: unknown; _seconds?: unknown; toDate?: () => Date }
    const seconds = typeof record.seconds === 'number' ? record.seconds : record._seconds
    if (typeof seconds === 'number') {
      return dateFromTimestampLike(seconds)
    }

    const date = record.toDate?.()
    return date && !Number.isNaN(date.getTime()) ? date : null
  }

  return null
}

function mediaUrlFromValue(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const candidate =
    record.thumbnailURL ??
    record.downloadURL ??
    record.url ??
    record.uri ??
    record.source ??
    record.path ??
    record.photo

  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

function SafeImage({ className, url }: { className: string; url: string }) {
  const [hasError, setHasError] = useState(false)

  if (hasError || isKnownMissingImageUrl(url)) {
    return (
      <span
        aria-label="Image unavailable"
        className={`${className} flex items-center justify-center bg-muted text-xs text-muted-foreground`}
      >
        -
      </span>
    )
  }

  return (
    <img
      alt=""
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      src={url}
      onError={() => setHasError(true)}
    />
  )
}

function isKnownMissingImageUrl(url: string) {
  return /iosapptemplates\.com\/wp-content\/uploads\/2019\/06\/empty-avatar\.jpg/i.test(url)
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength - 1) + '...' : value
}

function readDownloadFileName(response: Response) {
  const disposition = response.headers.get('content-disposition')
  const match = disposition?.match(/filename="([^"]+)"/)
  return match?.[1]
}
