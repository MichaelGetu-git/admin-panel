'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { getFirebaseFirestoreClient } from '@/lib/client/firebase'
import { Search, X } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string
  title?: string
  place?: string
  photo?: string
  isApproved?: boolean
  createdAt?: number
}

const LISTINGS_COL = 'store_locator_listings'

// ── Action Modal (web equivalent of mobile long-press action sheet) ───────────

function ActionModal({
  listing,
  onEdit,
  onDelete,
  onClose,
}: {
  listing: Listing
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-[22px] border bg-card p-5 pb-7 sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile feel) */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        {/* Title */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="truncate font-bold">{listing.title || 'Untitled'}</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Confirm
          </p>

          {/* Edit */}
          <button
            onClick={onEdit}
            className="w-full rounded-2xl border bg-muted/50 py-3.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Edit
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="w-full rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            className="w-full rounded-2xl border bg-muted py-3.5 text-sm font-bold transition-colors hover:bg-muted/70"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminListingsPage() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const db = getFirebaseFirestoreClient()
    const q = query(collection(db, LISTINGS_COL), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setListings(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Listing))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filtered = search.trim()
    ? listings.filter(l => {
        const q = search.toLowerCase().trim()
        const title = (l.title || '').toLowerCase()
        const place = (l.place || '').toLowerCase()
        return title.includes(q) || place.includes(q)
      })
    : listings

  const handleEdit = (listing: Listing) => {
    setSelectedListing(null)
    router.push(`/admin/listings/${listing.id}/update`)
  }

  const handleDelete = async (listing: Listing) => {
    setSelectedListing(null)
    if (!confirm('Are you sure you want to remove this listing?')) return

    setDeletingId(listing.id)
    try {
      const db = getFirebaseFirestoreClient()
      await deleteDoc(doc(db, LISTINGS_COL, listing.id))
    } catch {
      alert('Could not delete listing. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">All Workshops</h1>
        <p className="mt-1 text-xs italic text-muted-foreground opacity-80">
          Tap a listing to edit or delete
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search listings..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-2xl border bg-muted/40 py-3 pl-9 pr-4 text-sm outline-none ring-primary focus:ring-2"
        />
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {loading ? 'Loading…' : `${filtered.length} results`}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          There are no workshops found.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map(listing => (
            <button
              key={listing.id}
              onClick={() => setSelectedListing(listing)}
              disabled={deletingId === listing.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card text-left transition-shadow hover:shadow-md disabled:opacity-50"
            >
              {/* Photo */}
              <div className="relative aspect-[4/3] w-full bg-muted">
                {listing.photo ? (
                  <img
                    src={listing.photo}
                    alt={listing.title || 'Listing'}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="text-xs text-muted-foreground">No Photo</span>
                  </div>
                )}

                {/* Pending Badge */}
                {listing.isApproved === false && (
                  <div className="absolute left-2.5 top-2.5 rounded-lg bg-orange-500 px-2 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                      Pending
                    </span>
                  </div>
                )}

                {/* Deleting spinner */}
                {deletingId === listing.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex flex-col p-3">
                <p className="line-clamp-2 text-sm font-bold leading-snug">
                  {listing.title || 'Untitled'}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {listing.place || 'Unknown location'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Action Modal — web equivalent of mobile long-press action sheet */}
      {selectedListing && (
        <ActionModal
          listing={selectedListing}
          onEdit={() => handleEdit(selectedListing)}
          onDelete={() => void handleDelete(selectedListing)}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </div>
  )
}
