import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { getFirebaseFirestoreClient } from '@/lib/client/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FiltersFieldEditorProps {
  disabled: boolean
  value: string
  onChange: (value: string) => void
}

export function FiltersFieldEditor({ disabled, value, onChange }: FiltersFieldEditorProps) {
  const [filtersDef, setFiltersDef] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const db = getFirebaseFirestoreClient()
        const snap = await getDocs(collection(db, 'store_locator_filters'))
        setFiltersDef(snap.docs.map(d => d.data()))
      } catch (err) {
        console.error('Failed to load filters', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  let parsed: Record<string, string> = {}
  try {
    parsed = value ? JSON.parse(value) : {}
  } catch {
    parsed = {}
  }

  function toggleFilter(filterName: string, option: string) {
    const newFilters = { ...parsed }
    if (newFilters[filterName] === option) {
      delete newFilters[filterName]
    } else {
      newFilters[filterName] = option
    }
    onChange(JSON.stringify(newFilters, null, 2))
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading filters...</div>
  }

  return (
    <div className="space-y-4">
      {filtersDef.map(filter => (
        <div key={filter.name} className="space-y-1">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            {filter.name}
          </label>
          <div className="flex flex-wrap gap-2">
            {(filter.options || []).map((opt: string) => {
              const isSelected = parsed[filter.name] === opt
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleFilter(filter.name, opt)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
                  } disabled:opacity-50`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

interface LocationFieldGroupProps {
  disabled: boolean
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}

export function LocationFieldGroup({ disabled, values, onChange }: LocationFieldGroupProps) {
  const place = values.place || ''
  const location = values.location || ''
  const lat = values.latitude || ''
  const lng = values.longitude || ''

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Place Name / Neighborhood</label>
        <Input
          disabled={disabled}
          value={place}
          onChange={e => onChange('place', e.target.value)}
          placeholder="e.g. San Francisco, CA"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Full Address</label>
        <Input
          disabled={disabled}
          value={location}
          onChange={e => onChange('location', e.target.value)}
          placeholder="e.g. 123 Main St..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Latitude</label>
          <Input
            type="number"
            disabled={disabled}
            value={lat}
            onChange={e => onChange('latitude', e.target.value)}
            placeholder="37.7749"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Longitude</label>
          <Input
            type="number"
            disabled={disabled}
            value={lng}
            onChange={e => onChange('longitude', e.target.value)}
            placeholder="-122.4194"
          />
        </div>
      </div>
      {lat && lng && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs text-primary hover:underline"
        >
          View on Google Maps ↗
        </a>
      )}
    </div>
  )
}
