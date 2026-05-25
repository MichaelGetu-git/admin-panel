import { useEffect, useMemo, useState } from 'react'
import { Braces, Loader2, Upload, X } from 'lucide-react'
import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type FieldMap = AdminEntityConfig['fields']
export type FieldConfig = FieldMap extends Record<string, infer Field> ? Field : never
export type FieldEntry = [string, FieldConfig]
export type RecordValue = Record<string, unknown> & { id?: string }

interface RenderFieldOptions {
  disabled: boolean
  field: FieldConfig
  id: string
  onChange: (value: string) => void
  onUploadFiles?: (files: FileList) => void
  required: boolean
  uploading?: boolean
  value: string
}

export function renderField({
  disabled,
  field,
  id,
  onChange,
  onUploadFiles,
  required,
  uploading = false,
  value,
}: RenderFieldOptions) {
  if (field.type === 'foreignKey') {
    return (
      <ForeignKeySelector
        disabled={disabled}
        field={field}
        id={id}
        onChange={onChange}
        required={required}
        value={value}
      />
    )
  }

  if (field.type === 'foreignKeys') {
    return (
      <ForeignKeysSelector
        disabled={disabled}
        field={field}
        id={id}
        onChange={onChange}
        required={required}
        value={value}
      />
    )
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex h-9 items-center">
        <input
          checked={value === 'true'}
          className="h-4 w-4 rounded border-input"
          disabled={disabled}
          id={id}
          onChange={event => onChange(event.target.checked ? 'true' : 'false')}
          type="checkbox"
        />
      </div>
    )
  }

  if (field.type === 'enum') {
    return (
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        id={id}
        onChange={event => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">Select...</option>
        {(field.options ?? []).map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'richText' || isJsonField(field)) {
    if (field.type === 'photos') {
      return (
        <div className="space-y-2">
          <Textarea
            disabled={disabled}
            id={id}
            onChange={event => onChange(event.target.value)}
            required={required}
            rows={6}
            value={value}
          />
          {!disabled && (
            <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload photos
              <input
                accept="image/*"
                className="sr-only"
                disabled={uploading}
                multiple
                onChange={event => {
                  if (event.target.files) {
                    onUploadFiles?.(event.target.files)
                    event.target.value = ''
                  }
                }}
                type="file"
              />
            </label>
          )}
          <MediaPreviewGrid value={value} />
        </div>
      )
    }

    if (isJsonField(field)) {
      return (
        <JsonFieldInput
          disabled={disabled}
          field={field}
          id={id}
          onChange={onChange}
          required={required}
          value={value}
        />
      )
    }

    return (
      <Textarea
        disabled={disabled}
        id={id}
        onChange={event => onChange(event.target.value)}
        required={required}
        rows={field.type === 'richText' ? 8 : 6}
        value={value}
      />
    )
  }

  if (field.type === 'photo' || field.type === 'media') {
    return (
      <div className="space-y-2">
        <Input
          disabled={disabled}
          id={id}
          onChange={event => onChange(event.target.value)}
          required={required}
          type="url"
          value={value}
        />
        {!disabled && (
          <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload file
            <input
              accept={field.type === 'photo' ? 'image/*' : undefined}
              className="sr-only"
              disabled={uploading}
              onChange={event => {
                if (event.target.files) {
                  onUploadFiles?.(event.target.files)
                  event.target.value = ''
                }
              }}
              type="file"
            />
          </label>
        )}
        <SingleMediaPreview value={value} />
      </div>
    )
  }

  return (
    <Input
      className={field.type === 'color' ? 'h-10 w-20 p-1' : undefined}
      disabled={disabled}
      id={id}
      onChange={event => onChange(event.target.value)}
      required={required}
      step={field.type === 'number' ? 'any' : undefined}
      type={inputTypeForField(field)}
      value={value}
    />
  )
}

function JsonFieldInput({
  disabled,
  field,
  id,
  onChange,
  required,
  value,
}: {
  disabled: boolean
  field: FieldConfig
  id: string
  onChange: (value: string) => void
  required: boolean
  value: string
}) {
  const [formatError, setFormatError] = useState<string | null>(null)

  function formatJson() {
    try {
      const parsed = JSON.parse(value)
      onChange(JSON.stringify(parsed, null, 2))
      setFormatError(null)
    } catch {
      setFormatError(field.label + ' must be valid JSON before formatting.')
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        disabled={disabled}
        id={id}
        onChange={event => {
          onChange(event.target.value)
          if (formatError) {
            setFormatError(null)
          }
        }}
        required={required}
        rows={6}
        value={value}
      />
      <div className="flex flex-wrap items-center gap-2">
        {!disabled && (
          <Button size="sm" type="button" variant="outline" onClick={formatJson}>
            <Braces className="mr-2 h-4 w-4" />
            Format JSON
          </Button>
        )}
        {formatError && <span className="text-xs text-destructive">{formatError}</span>}
      </div>
      <JsonFieldPreview value={value} />
    </div>
  )
}

function JsonFieldPreview({ value }: { value: string }) {
  const parsed = parsePreviewJson(value)
  if (!parsed.ok) {
    return null
  }

  if (Array.isArray(parsed.value)) {
    const mediaItems = parsed.value
      .map(item => findMediaPreviewUrl(item))
      .filter((url): url is string => Boolean(url))
      .slice(0, 8)

    return (
      <div className="space-y-2 rounded-md border bg-muted/30 p-2">
        <div className="text-xs text-muted-foreground">
          {parsed.value.length} array item{parsed.value.length === 1 ? '' : 's'}
        </div>
        {mediaItems.length > 0 && <MediaPreviewGrid urls={mediaItems} />}
      </div>
    )
  }

  if (parsed.value && typeof parsed.value === 'object') {
    const entries = Object.entries(parsed.value as Record<string, unknown>).slice(0, 5)

    return (
      <div className="space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
        {entries.map(([key, item]) => (
          <div key={key} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
            <span className="truncate font-medium">{key}</span>
            <span className="truncate text-muted-foreground">
              {previewScalarValue(item)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return null
}

function SingleMediaPreview({ value }: { value: string }) {
  const url = findMediaPreviewUrl(parsePossibleJson(value) ?? value)
  if (!url) {
    return null
  }

  return <MediaPreviewGrid urls={[url]} />
}

function MediaPreviewGrid({
  urls,
  value,
}: {
  urls?: string[]
  value?: string
}) {
  const mediaUrls = urls ?? parseStringArrayValue(value ?? '')
  const visibleUrls = mediaUrls.filter(Boolean).slice(0, 8)

  if (visibleUrls.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {visibleUrls.map(url => (
        <a
          key={url}
          className="group relative block aspect-square overflow-hidden rounded-md border bg-muted"
          href={url}
          rel="noreferrer"
          target="_blank"
        >
          {isImageUrl(url) ? (
            <SafeImage
              className="h-full w-full object-cover transition group-hover:scale-105"
              url={url}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
              {truncate(url, 64)}
            </div>
          )}
        </a>
      ))}
    </div>
  )
}

function parsePreviewJson(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch {
    return { ok: false }
  }
}

function findMediaPreviewUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const candidate =
    record.thumbnailURL ??
    record.downloadURL ??
    record.photo ??
    record.url ??
    record.uri ??
    record.source ??
    record.path ??
    record.image ??
    record.imageUrl

  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

function parsePossibleJson(value: string): unknown | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function previewScalarValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.length + ' items'
  }

  if (value && typeof value === 'object') {
    return '{...}'
  }

  return ''
}

function isImageUrl(value: string) {
  return /^https?:\/\//.test(value) && !/\.(mp4|mov|webm)(\?|$)/i.test(value)
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

interface ReferenceOption {
  id: string
  label: string
  subtitle: string
  photo?: string
}

interface ReferenceSelectorProps {
  disabled: boolean
  field: FieldConfig
  id: string
  onChange: (value: string) => void
  required: boolean
  value: string
}

function ForeignKeySelector({
  disabled,
  field,
  id,
  onChange,
  required,
  value,
}: ReferenceSelectorProps) {
  const targetEntity = useMemo(() => getTargetEntity(field), [field])
  const selectedIds = useMemo(() => {
    const trimmedValue = value.trim()
    return trimmedValue ? [trimmedValue] : []
  }, [value])
  const {
    error,
    isLoading,
    options,
    search,
    selectedOptions,
    setSearch,
  } = useReferenceOptions(targetEntity, field, selectedIds)
  const selectedOption = selectedOptions[0]

  if (!targetEntity) {
    return (
      <Input
        disabled={disabled}
        id={id}
        onChange={event => onChange(event.target.value)}
        required={required}
        value={value}
      />
    )
  }

  return (
    <div className="space-y-2">
      <Input
        disabled={disabled}
        id={id}
        onChange={event => setSearch(event.target.value)}
        placeholder={'Search ' + targetEntity.displayName}
        value={disabled ? selectedOption?.label ?? value : search}
      />
      {value && (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <ReferenceOptionLabel option={selectedOption ?? fallbackReferenceOption(value)} />
          {!disabled && (
            <Button
              aria-label="Clear selection"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => onChange('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      {!disabled && (
        <ReferenceOptionsList
          error={error}
          isLoading={isLoading}
          options={options}
          selectedIds={selectedIds}
          onSelect={option => {
            onChange(option.id)
            setSearch(option.label)
          }}
        />
      )}
    </div>
  )
}

function ForeignKeysSelector({
  disabled,
  field,
  id,
  onChange,
  required,
  value,
}: ReferenceSelectorProps) {
  const targetEntity = useMemo(() => getTargetEntity(field), [field])
  const selectedIds = useMemo(() => parseStringArrayValue(value), [value])
  const {
    error,
    isLoading,
    options,
    search,
    selectedOptions,
    setSearch,
  } = useReferenceOptions(targetEntity, field, selectedIds)

  if (!targetEntity) {
    return (
      <Textarea
        disabled={disabled}
        id={id}
        onChange={event => onChange(event.target.value)}
        required={required}
        rows={6}
        value={value}
      />
    )
  }

  function setSelectedIds(nextIds: string[]) {
    onChange(JSON.stringify(Array.from(new Set(nextIds)), null, 2))
  }

  return (
    <div className="space-y-2">
      <Input
        disabled={disabled}
        id={id}
        onChange={event => setSearch(event.target.value)}
        placeholder={'Search ' + targetEntity.displayName}
        value={disabled ? '' : search}
      />
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-md border bg-muted/40 p-2">
          {selectedIds.map(selectedId => {
            const option =
              selectedOptions.find(item => item.id === selectedId) ??
              fallbackReferenceOption(selectedId)

            return (
              <span
                key={selectedId}
                className="inline-flex max-w-full items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm"
              >
                <span className="truncate">{option.label}</span>
                {!disabled && (
                  <button
                    aria-label={'Remove ' + option.label}
                    className="rounded text-muted-foreground hover:text-foreground"
                    type="button"
                    onClick={() =>
                      setSelectedIds(selectedIds.filter(id => id !== selectedId))
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}
      {!disabled && (
        <ReferenceOptionsList
          error={error}
          isLoading={isLoading}
          options={options}
          selectedIds={selectedIds}
          onSelect={option => {
            setSelectedIds([...selectedIds, option.id])
            setSearch('')
          }}
        />
      )}
    </div>
  )
}

function ReferenceOptionsList({
  error,
  isLoading,
  onSelect,
  options,
  selectedIds,
}: {
  error: string | null
  isLoading: boolean
  onSelect: (option: ReferenceOption) => void
  options: ReferenceOption[]
  selectedIds: string[]
}) {
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border">
      {isLoading && (
        <div className="flex items-center px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </div>
      )}
      {!isLoading && error && (
        <div className="px-3 py-2 text-sm text-destructive">{error}</div>
      )}
      {!isLoading && !error && options.length === 0 && (
        <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
      )}
      {!isLoading && !error && options.map(option => {
        const isSelected = selectedIds.includes(option.id)

        return (
          <button
            key={option.id}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSelected}
            type="button"
            onClick={() => onSelect(option)}
          >
            <ReferenceOptionLabel option={option} />
          </button>
        )
      })}
    </div>
  )
}

function ReferenceOptionLabel({ option }: { option: ReferenceOption }) {
  return (
    <>
      {option.photo && (
        <SafeImage className="h-7 w-7 shrink-0 rounded object-cover" url={option.photo} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{option.label}</span>
        {option.subtitle && (
          <span className="block truncate text-xs text-muted-foreground">
            {option.subtitle}
          </span>
        )}
      </span>
    </>
  )
}

function useReferenceOptions(
  targetEntity: AdminEntityConfig | undefined,
  field: FieldConfig,
  selectedIds: string[],
) {
  const selectedIdsKey = JSON.stringify(selectedIds)
  const stableSelectedIds = useMemo(() => selectedIds, [selectedIdsKey])
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<ReferenceOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<ReferenceOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!targetEntity) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void loadReferenceOptions(targetEntity, field, search, controller.signal)
        .then(setOptions)
        .catch(loadError => {
          if (controller.signal.aborted) {
            return
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load references.',
          )
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false)
          }
        })
    }, 180)

    setIsLoading(true)
    setError(null)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [field, search, targetEntity])

  useEffect(() => {
    if (!targetEntity || stableSelectedIds.length === 0) {
      setSelectedOptions([])
      return
    }

    const controller = new AbortController()
    void loadSelectedReferenceOptions(targetEntity, field, stableSelectedIds, controller.signal)
      .then(setSelectedOptions)
      .catch(() => setSelectedOptions(stableSelectedIds.map(fallbackReferenceOption)))

    return () => controller.abort()
  }, [field, stableSelectedIds, targetEntity])

  return {
    error,
    isLoading,
    options,
    search,
    selectedOptions,
    setSearch,
  }
}

async function loadReferenceOptions(
  targetEntity: AdminEntityConfig,
  field: FieldConfig,
  search: string,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({ limit: '10' })
  const trimmedSearch = search.trim()
  if (trimmedSearch.length > 0) {
    params.set('search', trimmedSearch)
  }

  const response = await fetch('/api/admin/' + targetEntity.route + '?' + params.toString(), {
    credentials: 'include',
    signal,
  })
  const data = (await response.json().catch(() => null)) as {
    items?: RecordValue[]
    error?: string
  } | null

  if (!response.ok) {
    throw new Error(data?.error ?? 'Failed to load references.')
  }

  return (data?.items ?? []).map(record => toReferenceOption(record, targetEntity, field))
}

async function loadSelectedReferenceOptions(
  targetEntity: AdminEntityConfig,
  field: FieldConfig,
  ids: string[],
  signal: AbortSignal,
) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 12)
  const results = await Promise.all(
    uniqueIds.map(async id => {
      const response = await fetch(
        '/api/admin/' + targetEntity.route + '/' + encodeURIComponent(id),
        {
          credentials: 'include',
          signal,
        },
      )
      const data = (await response.json().catch(() => null)) as {
        item?: RecordValue
      } | null

      return response.ok && data?.item
        ? toReferenceOption(data.item, targetEntity, field)
        : fallbackReferenceOption(id)
    }),
  )

  return results
}

function getTargetEntity(field: FieldConfig) {
  if (!field.entity) {
    return undefined
  }

  return adminPanelConfig.entities.find(entity => entity.key === field.entity)
}

function toReferenceOption(
  record: RecordValue,
  targetEntity: AdminEntityConfig,
  field: FieldConfig,
): ReferenceOption {
  const labelField = field.titleField ?? targetEntity.titleField
  const label = valueToReferenceText(record[labelField]) || String(record.id ?? '')
  const subtitle = buildReferenceSubtitle(record, targetEntity, labelField)
  const photo = getReferencePhoto(record, targetEntity)

  return {
    id: String(record.id ?? ''),
    label,
    subtitle,
    photo,
  }
}

function buildReferenceSubtitle(
  record: RecordValue,
  targetEntity: AdminEntityConfig,
  labelField: string,
) {
  const subtitleFields = [targetEntity.titleField, ...targetEntity.typeaheadFields, ...targetEntity.listFields]
    .filter(fieldKey => fieldKey !== labelField)
    .filter((fieldKey, index, array) => array.indexOf(fieldKey) === index)

  return subtitleFields
    .map(fieldKey => valueToReferenceText(record[fieldKey]))
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ')
}

function getReferencePhoto(record: RecordValue, targetEntity: AdminEntityConfig) {
  const photoField = [...targetEntity.typeaheadFields, ...targetEntity.listFields].find(
    fieldKey => {
      const field = targetEntity.fields[fieldKey]
      return field?.type === 'photo'
    },
  )
  const value = photoField ? record[photoField] : undefined
  return findMediaPreviewUrl(value) ?? undefined
}

function valueToReferenceText(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return ''
}

function fallbackReferenceOption(id: string): ReferenceOption {
  return {
    id,
    label: id,
    subtitle: '',
  }
}

function inputTypeForField(field: FieldConfig) {
  if (field.type === 'number') {
    return 'number'
  }

  if (field.type === 'date') {
    return 'datetime-local'
  }

  if (field.type === 'photo' || field.type === 'media') {
    return 'url'
  }

  if (field.type === 'color') {
    return 'color'
  }

  return 'text'
}

export function getInitialValues(fields: FieldEntry[]) {
  return Object.fromEntries(
    fields.map(([key, field]) => [
      key,
      field.defaultValue === undefined ? defaultValueForField(field) : valueToFormValue(field.defaultValue, field),
    ]),
  )
}

export function recordToFormValues(record: RecordValue, fields: FieldEntry[]) {
  return Object.fromEntries(
    fields.map(([key, field]) => [key, valueToFormValue(record[key], field)]),
  )
}

function defaultValueForField(field: FieldConfig) {
  if (field.type === 'boolean') {
    return 'false'
  }

  if (field.type === 'array' || field.type === 'photos' || field.type === 'foreignKeys') {
    return '[]'
  }

  if (field.type === 'object' || field.type === 'location') {
    return '{}'
  }

  return ''
}

function valueToFormValue(value: unknown, field: FieldConfig): string {
  if (value === undefined || value === null) {
    return defaultValueForField(field)
  }

  if (field.type === 'boolean') {
    return value === true ? 'true' : 'false'
  }

  if (field.type === 'date') {
    return toDateTimeLocal(value)
  }

  if (isJsonField(field)) {
    return JSON.stringify(value, null, 2)
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }

  return String(value)
}

export function buildPayload(fields: FieldEntry[], values: Record<string, string>) {
  const payload: Record<string, unknown> = {}

  for (const [key, field] of fields) {
    if (key === 'id' || key === '_id' || isAuditField(key)) {
      continue
    }

    const rawValue = values[key] ?? ''
    if (field.required && isEmptyRequiredValue(field, rawValue)) {
      throw new Error(field.label + ' is required.')
    }

    const value = parseFieldValue(key, field, rawValue)
    if (value !== undefined) {
      payload[key] = value
    }
  }

  return payload
}

function parseFieldValue(key: string, field: FieldConfig, rawValue: string): unknown {
  if (field.type === 'boolean') {
    return rawValue === 'true'
  }

  if (field.type === 'number') {
    const trimmed = rawValue.trim()
    if (trimmed.length === 0) {
      return null
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      throw new Error(field.label + ' must be a number.')
    }

    return parsed
  }

  if (field.type === 'date') {
    const trimmed = rawValue.trim()
    if (trimmed.length === 0) {
      return null
    }

    const date = new Date(trimmed)
    if (Number.isNaN(date.getTime())) {
      throw new Error(field.label + ' must be a valid date.')
    }

    return date.toISOString()
  }

  if (isJsonField(field)) {
    return parseJsonField(key, field, rawValue)
  }

  return rawValue
}

function isEmptyRequiredValue(field: FieldConfig, rawValue: string) {
  const trimmed = rawValue.trim()
  if (trimmed.length === 0) {
    return true
  }

  if (field.type === 'array' || field.type === 'photos' || field.type === 'foreignKeys') {
    return parseJsonArrayValue(rawValue).length === 0
  }

  return false
}

function parseJsonField(key: string, field: FieldConfig, rawValue: string) {
  const trimmed = rawValue.trim()

  if (trimmed.length === 0) {
    if (field.type === 'array' || field.type === 'photos' || field.type === 'foreignKeys') {
      return []
    }

    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(field.label + ' must be valid JSON.')
  }

  if (
    (field.type === 'array' || field.type === 'photos' || field.type === 'foreignKeys') &&
    !Array.isArray(parsed)
  ) {
    throw new Error(field.label + ' must be a JSON array.')
  }

  if (
    (field.type === 'object' || field.type === 'location') &&
    (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
  ) {
    throw new Error(field.label + ' must be a JSON object.')
  }

  return parsed
}

export function parseJsonArrayValue(rawValue: string): unknown[] {
  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseStringArrayValue(rawValue: string): string[] {
  return parseJsonArrayValue(rawValue)
    .map(item => (typeof item === 'string' || typeof item === 'number' ? String(item) : ''))
    .filter(Boolean)
}

function isJsonField(field: FieldConfig) {
  return (
    field.type === 'array' ||
    field.type === 'foreignKeys' ||
    field.type === 'location' ||
    field.type === 'object' ||
    field.type === 'photos'
  )
}

export function isAuditField(key: string) {
  return key === 'createdAt' || key === 'updatedAt'
}

function toDateTimeLocal(value: unknown) {
  const date = dateFromTimestampLike(value)
  if (!date) {
    return ''
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
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
