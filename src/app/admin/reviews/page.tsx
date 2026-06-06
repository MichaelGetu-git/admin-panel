'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getFirebaseFirestoreClient } from '@/lib/client/firebase'
import { Trash2, X } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Review {
  id: string
  firstName?: string
  lastName?: string
  content?: string
  starCount?: number
  listingID?: string
  createdAt?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const REVIEWS_COL = 'store_locator_reviews'
const LISTINGS_COL = 'store_locator_listings'

function renderStars(count?: number) {
  const n = Math.round(count ?? 0)
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n))
}

function formatDate(ts?: number) {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString()
}

// ── Delete + Recalculate ─────────────────────────────────────────────────────

async function deleteReviewAndRecalculate(review: Review) {
  const confirmed = confirm(
    'Delete this review? This will recalculate the listing rating.',
  )
  if (!confirmed) return

  const db = getFirebaseFirestoreClient()

  // Delete the review
  await deleteDoc(doc(db, REVIEWS_COL, review.id))

  // Recalculate listing star count — same logic as mobile
  if (review.listingID) {
    const remaining = await getDocs(
      query(collection(db, REVIEWS_COL), where('listingID', '==', review.listingID)),
    )

    let total = 0
    let count = 0
    remaining.docs.forEach(d => {
      total += (d.data().starCount as number) || 0
      count++
    })

    const avg = count > 0 ? total / count : 0
    await updateDoc(doc(db, LISTINGS_COL, review.listingID), {
      starCount: avg,
      reviewsCount: count,
      numberOfReviews: count,
    })
  }
}

// ── Action Modal ──────────────────────────────────────────────────────────────

function ActionModal({
  onDelete,
  onClose,
}: {
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
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-bold">Review by Garage</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {/* Delete */}
          <button
            onClick={onDelete}
            className="w-full rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete Review
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

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [listingNames, setListingNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const db = getFirebaseFirestoreClient()
    const q = query(collection(db, REVIEWS_COL), orderBy('createdAt', 'desc'))

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Review)
      setReviews(data)
      setLoading(false)

      // Resolve listing names for all unique listing IDs (same as mobile)
      const uniqueIds = [...new Set(data.map(r => r.listingID).filter(Boolean))] as string[]
      setListingNames(prev => {
        const toFetch = uniqueIds.filter(id => !prev[id])
        if (toFetch.length === 0) return prev

        void Promise.all(
          toFetch.map(id =>
            getDoc(doc(db, LISTINGS_COL, id)).then(snap => ({
              id,
              name: snap.exists()
                ? ((snap.data()?.title as string) ?? (snap.data()?.name as string) ?? 'Deleted Listing')
                : 'Deleted Listing',
            })),
          ),
        ).then(results => {
          setListingNames(old => {
            const updated = { ...old }
            results.forEach(r => { updated[r.id] = r.name })
            return updated
          })
        })

        return prev
      })
    })

    return () => unsub()
  }, [])

  const handleDelete = async (review: Review) => {
    setSelectedReview(null)
    setDeletingId(review.id)
    try {
      await deleteReviewAndRecalculate(review)
    } catch {
      alert('Could not delete review. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Review Moderation</h1>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {loading ? 'Loading…' : `${reviews.length} reviews`}
      </p>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && reviews.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No reviews yet.</p>
      )}

      {/* Review cards */}
      {!loading && reviews.length > 0 && (
        <div className="space-y-2.5">
          {reviews.map(review => (
            <button
              key={review.id}
              onClick={() => setSelectedReview(review)}
              disabled={deletingId === review.id}
              className="w-full rounded-2xl border bg-card p-4 text-left transition-shadow hover:shadow-sm disabled:opacity-50"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Reviewer name + stars on same row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">
                      {`${review.firstName ?? ''} ${review.lastName ?? ''}`.trim() || 'Anonymous'}
                    </p>
                    <span className="text-sm text-yellow-500">
                      {renderStars(review.starCount)}
                    </span>
                  </div>

                  {/* Review text */}
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {review.content || ''}
                  </p>

                  {/* Listing + date */}
                  <p className="mt-2 text-xs font-medium text-primary">
                    Listing: {listingNames[review.listingID ?? ''] ?? review.listingID ?? '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    {formatDate(review.createdAt)}
                  </p>
                </div>

                {/* Deleting spinner (replaces trash button) */}
                {deletingId === review.id && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {selectedReview && (
        <ActionModal
          onDelete={() => void handleDelete(selectedReview)}
          onClose={() => setSelectedReview(null)}
        />
      )}
    </div>
  )
}
