'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save, Settings2, Trash2, UserCircle2 } from 'lucide-react'
import type { AdminEntityConfig } from '@/generated/admin-panel.config'
import { canRunEntityWorkflows, canWriteEntity } from '@/lib/admin-permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatingModerationActions } from '@/components/admin/dating-moderation-actions'
import { EntityWorkflowActions } from '@/components/admin/entity-workflow-actions'
import {
  buildPayload,
  getInitialValues,
  isAuditField,
  parseJsonArrayValue,
  recordToFormValues,
  renderField,
  type FieldConfig,
  type FieldEntry,
  type RecordValue,
} from '@/components/admin/entity-form-fields'
interface UserFormPageProps {
  adminRole: string
  entity: AdminEntityConfig
  mode: 'create' | 'view' | 'update'
  recordId?: string
}

export function UserFormPage({ adminRole, entity, mode, recordId }: UserFormPageProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'profile' | 'advanced'>('profile')
  const fieldEntries = useMemo(
    () => Object.entries(entity.fields as Record<string, FieldConfig>),
    [entity.fields],
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [record, setRecord] = useState<RecordValue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(mode !== 'create')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const canWrite = canWriteEntity(adminRole, entity)
  const canRunWorkflows = canRunEntityWorkflows(adminRole, entity)
  const isReadOnly = mode === 'view' || !canWrite

  useEffect(() => {
    if (mode === 'create') {
      setValues(getInitialValues(fieldEntries))
      setRecord(null)
    }
  }, [fieldEntries, mode])

  const loadRecord = useCallback(async () => {
    if (mode === 'create' || !recordId) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        '/api/admin/' + entity.route + '/' + encodeURIComponent(recordId),
        { credentials: 'include' },
      )

      if (response.status === 401) {
        router.replace('/login')
        return
      }

      const data = (await response.json().catch(() => null)) as {
        item?: RecordValue
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to load record.')
      }

      const item = data?.item ?? {}
      setRecord(item)
      setValues(recordToFormValues(item, fieldEntries))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load record.')
    } finally {
      setIsLoading(false)
    }
  }, [entity.route, fieldEntries, mode, recordId, router])

  useEffect(() => {
    void loadRecord()
  }, [loadRecord])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isReadOnly) {
      return
    }

    setIsSaving(true)
    setError(null)
    setStatusMessage(null)

    try {
      const payload = buildPayload(fieldEntries, values)

      const endpoint =
        mode === 'create'
          ? '/api/admin/' + entity.route
          : '/api/admin/' + entity.route + '/' + encodeURIComponent(recordId ?? '')
      const response = await fetch(endpoint, {
        method: mode === 'create' ? 'POST' : 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await response.json().catch(() => null)) as {
        id?: string
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to save record.')
      }

      if (mode === 'create' && data?.id) {
        router.replace('/admin/' + entity.route + '/' + data.id + '/update')
      } else {
        setStatusMessage('Saved.')
        router.refresh()
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save record.')
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteRecord() {
    if (!recordId || !window.confirm('Delete this record?')) {
      return
    }

    setIsDeleting(true)
    setError(null)
    setStatusMessage(null)

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

      router.replace('/admin/' + entity.route)
      router.refresh()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete record.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  function setFieldValue(key: string, value: string) {
    setValues(current => ({
      ...current,
      [key]: value,
    }))
  }

  async function uploadFieldFiles(
    key: string,
    field: FieldConfig,
    currentValue: string,
    files: FileList,
  ) {
    if (files.length === 0) {
      return
    }

    setUploadingField(key)
    setError(null)

    try {
      const formData = new FormData()
      Array.from(files).forEach(file => formData.append('photos', file))

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as {
        data?: Array<{ url: string }>
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Upload failed.')
      }

      const urls = (data?.data ?? [])
        .map(file => file.url)
        .filter((url): url is string => typeof url === 'string' && url.length > 0)

      if (urls.length === 0) {
        throw new Error('Upload did not return any file URLs.')
      }

      if (field.type === 'photos') {
        const existing = parseJsonArrayValue(currentValue)
        setFieldValue(key, JSON.stringify([...existing, ...urls], null, 2))
      } else {
        setFieldValue(key, urls[0])
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
    } finally {
      setUploadingField(null)
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button asChild className="mb-4" size="sm" variant="ghost">
            <Link href={'/admin/' + entity.route}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {mode === 'create' ? 'Add' : mode === 'update' ? 'Update' : 'View'}{' '}
            {entity.singularName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{entity.collection}</Badge>
            <Badge variant={entity.access === 'readOnly' ? 'outline' : 'default'}>
              {entity.access}
            </Badge>
            {recordId && (
              <Badge className="max-w-full truncate" variant="outline">
                {recordId}
              </Badge>
            )}
          </div>
        </div>
        {canWrite && mode !== 'view' && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:pt-10">
            {mode === 'update' && recordId && (
              <Button
                className="shrink-0"
                disabled={isDeleting || isSaving}
                onClick={() => void deleteRecord()}
                size="icon"
                title="Delete"
                type="button"
                variant="outline"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button className="flex-1 sm:flex-none" disabled={isSaving || isLoading} type="submit">
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        )}
        {mode !== 'create' && record && canWrite && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:pt-10">
            <DatingModerationActions
              entity={entity}
              record={record}
              onCompleted={() => void loadRecord()}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {statusMessage && (
        <div className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {statusMessage}
        </div>
      )}

      {mode !== 'create' && record && canRunWorkflows && (
        <EntityWorkflowActions
          adminRole={adminRole}
          entity={entity}
          record={record}
          onCompleted={() => void loadRecord()}
        />
      )}

      <Card>
        {/* Tab bar: only show in edit/view mode — Advanced data doesn't exist on a new user */}
        {mode !== 'create' && (
          <div className="border-b">
            <div className="flex gap-1 px-4 pt-4">
              {([
                {
                  id: 'profile' as const,
                  icon: UserCircle2,
                  label: 'Profile',
                  sub: 'Identity & public info',
                },
                {
                  id: 'advanced' as const,
                  icon: Settings2,
                  label: 'Advanced',
                  sub: 'Tokens & system data',
                },
              ]).map(({ id, icon: Icon, label, sub }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`group flex items-center gap-3 rounded-t-lg px-4 py-3 text-left transition-all ${
                    activeTab === id
                      ? 'bg-background border border-b-0 border-border shadow-sm text-foreground -mb-px'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      activeTab === id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  />
                  <span className="hidden sm:block">
                    <span className="block text-sm font-medium leading-tight">{label}</span>
                    <span className="block text-[11px] text-muted-foreground leading-tight">{sub}</span>
                  </span>
                  <span className="block sm:hidden text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading record...
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              {fieldEntries
                .filter(([key]) => {
                  // Hide completely — internal app state the admin should never touch
                  if (key === 'orderRequestData') return false

                  // Profile tab: only the fields an admin actually fills in when creating/editing a user
                  const profileFields = [
                    'firstName', 'lastName', 'username', 'email', 'phone',
                    'profilePictureURL', 'bio', 'role', 'isActive',
                  ]

                  // In create mode: only show profile fields — Advanced data doesn't exist yet
                  if (mode === 'create') {
                    return profileFields.includes(key)
                  }
                  // Advanced tab: tokens, IDs, metrics, app-generated data, timestamps
                  const advancedFields = [
                    'userID', 'userId', 'pushToken', 'pushKitToken', 'badgeCount',
                    'isOnline', 'vendorID', 'inProgressOrderID',
                    'professionalVendorID', 'professionalCategoryID', 'professionalSkills',
                    'professionalSpecialty', 'pricePerHr', 'isFeatured', 'carName',
                    'carNumber', 'carType', 'ratings', 'ratingsCount', 'defaultPaymentKey',
                    'createdAt', 'updatedAt', 'lastOnlineTimestamp',
                    // User-generated app data — visible for reference, but admin cannot edit
                    'location', 'shippingAddress', 'savedPlaces', 'wishlist', 'photos',
                    'professionalSkills',
                  ]
                  if (activeTab === 'profile') {
                    return profileFields.includes(key)
                  } else {
                    return advancedFields.includes(key) || (!profileFields.includes(key) && !advancedFields.includes(key))
                  }
                })
                .map(([key, field]) => {
                  // These are set by the mobile app user — admins view but cannot edit them
                  const userGeneratedFields = [
                    'location', 'shippingAddress', 'savedPlaces', 'wishlist', 'photos',
                    'professionalSkills',
                  ]
                  const isUserGenerated = userGeneratedFields.includes(key)
                  const isFieldDisabled = isReadOnly || isAuditField(key) || isUserGenerated

                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium" htmlFor={'field-' + key}>
                          {field.label}
                          {field.required && <span className="text-destructive"> *</span>}
                        </label>
                        {isUserGenerated && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            Set by user
                          </span>
                        )}
                      </div>
                      {renderField({
                        disabled: isFieldDisabled,
                        field,
                        id: 'field-' + key,
                        value: values[key] ?? '',
                        onChange: value => setFieldValue(key, value),
                        onUploadFiles: files =>
                          void uploadFieldFiles(key, field, values[key] ?? '', files),
                        required: field.required === true,
                        uploading: uploadingField === key,
                      })}
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  )
}
