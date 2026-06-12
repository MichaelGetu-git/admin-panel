'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getFirebaseFirestoreClient } from '@/lib/client/firebase'
import { Edit2, Plus, PlusCircle, Trash2, X } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface FilterData {
  id: string
  name?: string
  type?: 'array' | 'string'
  options?: string[]
}

const FILTERS_COL = 'store_locator_filters'

// ── Modals ────────────────────────────────────────────────────────────────────

function AddFilterModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (name: string, type: 'array' | 'string', optionsStr: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'array' | 'string'>('array')
  const [optionsStr, setOptionsStr] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave(name, type, optionsStr)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg">
        <h3 className="mb-5 text-lg font-bold">Add New Filter</h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Filter Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Supported Car Brands"
              className="w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setType('array')}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  type === 'array' ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground'
                }`}
              >
                Multi Select
              </button>
              <button
                onClick={() => setType('string')}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  type === 'string' ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground'
                }`}
              >
                Single Select
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Options (comma-separated)</label>
            <input
              type="text"
              value={optionsStr}
              onChange={e => setOptionsStr(e.target.value)}
              placeholder="e.g. Tesla, Ford, BMW"
              className="w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl bg-muted py-3 text-sm font-bold hover:bg-muted/70 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={!name.trim() || saving}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddOptionModal({
  filter,
  onClose,
  onSave,
}: {
  filter: FilterData
  onClose: () => void
  onSave: (option: string) => Promise<void>
}) {
  const [option, setOption] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!option.trim()) return
    setSaving(true)
    await onSave(option.trim())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg">
        <h3 className="mb-5 text-lg font-bold">Add Option to {filter.name}</h3>

        <input
          type="text"
          value={option}
          onChange={e => setOption(e.target.value)}
          placeholder="New option name..."
          className="mb-6 w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl bg-muted py-3 text-sm font-bold hover:bg-muted/70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!option.trim() || saving}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RemoveOptionModal({
  optionName,
  onClose,
  onRemove,
}: {
  optionName: string
  onClose: () => void
  onRemove: () => Promise<void>
}) {
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    await onRemove()
    setRemoving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-[22px] border bg-card p-5 pb-7 sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-bold">Option: {optionName}</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={() => void handleRemove()}
            disabled={removing}
            className="w-full rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {removing ? 'Removing...' : 'Remove Option'}
          </button>

          <button
            onClick={onClose}
            disabled={removing}
            className="w-full rounded-2xl border bg-muted py-3.5 text-sm font-bold transition-colors hover:bg-muted/70 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FiltersPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<FilterData[]>([])
  const [loading, setLoading] = useState(true)

  const [isAddingFilter, setIsAddingFilter] = useState(false)
  const [addingOptionTo, setAddingOptionTo] = useState<FilterData | null>(null)
  const [removingOption, setRemovingOption] = useState<{ filter: FilterData; option: string } | null>(null)

  useEffect(() => {
    const db = getFirebaseFirestoreClient()
    const unsub = onSnapshot(collection(db, FILTERS_COL), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as FilterData)
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setFilters(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCreateFilter = async (name: string, type: 'array' | 'string', optionsStr: string) => {
    const optionsArr = optionsStr
      .split(',')
      .map(o => o.trim())
      .filter(Boolean)

    if (optionsArr.length === 0) {
      alert('Please add at least one option.')
      throw new Error('No options')
    }

    const db = getFirebaseFirestoreClient()
    const filterId = name.trim().replace(/\s+/g, '_')

    try {
      await setDoc(doc(db, FILTERS_COL, filterId), {
        name: name.trim(),
        type,
        options: optionsArr,
      })
      setIsAddingFilter(false)
    } catch {
      alert('Error creating filter')
    }
  }

  const handleDeleteFilter = async (filter: FilterData) => {
    if (!confirm(`Are you sure you want to delete the filter "${filter.name}"?`)) return
    try {
      const db = getFirebaseFirestoreClient()
      await deleteDoc(doc(db, FILTERS_COL, filter.id))
    } catch {
      alert('Error deleting filter')
    }
  }

  const handleAddOption = async (option: string) => {
    if (!addingOptionTo) return
    const db = getFirebaseFirestoreClient()
    const opts = addingOptionTo.options || []
    
    if (opts.includes(option)) {
      alert('Option already exists')
      throw new Error('Exists')
    }

    try {
      await updateDoc(doc(db, FILTERS_COL, addingOptionTo.id), {
        options: [...opts, option]
      })
      setAddingOptionTo(null)
    } catch {
      alert('Error adding option')
    }
  }

  const handleRemoveOption = async () => {
    if (!removingOption) return
    try {
      const db = getFirebaseFirestoreClient()
      const newOptions = (removingOption.filter.options || []).filter(o => o !== removingOption.option)
      await updateDoc(doc(db, FILTERS_COL, removingOption.filter.id), {
        options: newOptions
      })
      setRemovingOption(null)
    } catch {
      alert('Error removing option')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Filters</h1>
      </div>

      <button
        onClick={() => setIsAddingFilter(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/50 bg-primary/5 py-4 font-bold text-primary transition-colors hover:bg-primary/10"
      >
        <PlusCircle className="h-5 w-5" />
        Add New Filter
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">
          {filters.map(filter => (
            <div key={filter.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              {/* Header */}
              <div className="mb-1 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">{filter.name}</h2>
                  <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                    {filter.type === 'array' ? 'Multi Select' : 'Single Select'}
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => router.push(`/admin/filters/${filter.id}/update`)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Edit Details"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void handleDeleteFilter(filter)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                    title="Delete Filter"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Options Grid */}
              <div className="mt-5 flex flex-wrap gap-2">
                {(filter.options || []).map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setRemovingOption({ filter, option: opt })}
                    className="rounded-xl border bg-muted/30 px-3.5 py-2 text-sm transition-colors hover:bg-muted dark:hover:bg-muted/50"
                  >
                    {opt}
                  </button>
                ))}
                
                <button
                  onClick={() => setAddingOptionTo(filter)}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3.5 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {isAddingFilter && (
        <AddFilterModal
          onClose={() => setIsAddingFilter(false)}
          onSave={handleCreateFilter}
        />
      )}

      {addingOptionTo && (
        <AddOptionModal
          filter={addingOptionTo}
          onClose={() => setAddingOptionTo(null)}
          onSave={handleAddOption}
        />
      )}

      {removingOption && (
        <RemoveOptionModal
          optionName={removingOption.option}
          onClose={() => setRemovingOption(null)}
          onRemove={handleRemoveOption}
        />
      )}
    </div>
  )
}
