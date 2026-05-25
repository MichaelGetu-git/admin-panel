'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  EyeOff,
  Filter,
  ImageIcon,
  ListChecks,
  Loader2,
  MapPin,
  Megaphone,
  RefreshCw,
  Star,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ListingSummary {
  author: string
  category: string
  id: string
  isApproved: boolean | null
  isFeatured: boolean
  isPromoted: boolean
  issues: string[]
  photo: string
  place: string
  price: string
  reviewCount: number
  savedCount: number
  starCount: number
  title: string
}

interface ListingReviewSummary {
  content: string
  id: string
  listingID: string
  starCount: number
}

interface ListingCategorySummary {
  id: string
  issues: string[]
  name: string
  order: string
  totalListings: number
}

interface ListingFilterSummary {
  categories: string[]
  id: string
  issues: string[]
  name: string
  optionsCount: number
}

interface ListingLaunchIssue {
  detail: string
  label: string
  severity: 'high' | 'low' | 'medium'
}

interface ListingOperationsOverview {
  categories: {
    readinessIssues: ListingCategorySummary[]
    recent: ListingCategorySummary[]
    missingMedia: number
    missingOrder: number
    total: number
  }
  entities: {
    categories?: string
    filters?: string
    listings?: string
    reviews?: string
    savedListings?: string
  }
  filters: {
    missingOptions: number
    orphaned: number
    readinessIssues: ListingFilterSummary[]
    total: number
  }
  isEnabled: boolean
  launchReadiness: {
    issues: ListingLaunchIssue[]
    score: number
  }
  listings: {
    approved: number
    featured: number
    missingApproval: number
    missingCategory: number
    missingLocation: number
    missingMedia: number
    promoted: number
    pending: number
    recent: ListingSummary[]
    readinessIssues: ListingSummary[]
    total: number
  }
  maps: {
    missing: number
    ready: number
    withCoordinate: number
    withLatLng: number
  }
  media: {
    coverMissing: number
    galleryMissing: number
    missing: number
    ready: number
  }
  owners: {
    missingAuthor: number
    missingAuthorSnapshot: number
    uniqueAuthors: number
  }
  promotions: {
    candidates: ListingSummary[]
    featured: number
    promoted: number
  }
  queues: {
    mapIssues: ListingSummary[]
    mediaIssues: ListingSummary[]
    lowRatedReviews: ListingReviewSummary[]
    pendingListings: ListingSummary[]
  }
  reviews: {
    averageRating: number
    lowRated: number
    total: number
  }
  savedListings: {
    total: number
  }
}

export default function Page() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<ListingOperationsOverview | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  async function loadOverview() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/listing-operations/overview', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; overview?: ListingOperationsOverview }
        | null

      if (!response.ok || !data?.overview) {
        throw new Error(data?.error ?? 'Failed to load listing operations.')
      }

      setOverview(data.overview)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load listing operations.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  async function runAction(listingId: string, action: string) {
    setUpdatingKey(`${listingId}:${action}`)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/listing-operations/${encodeURIComponent(listingId)}/action`,
        {
          body: JSON.stringify({ action }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to update listing.')
      }

      await loadOverview()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update listing.')
    } finally {
      setUpdatingKey(null)
    }
  }

  if (!overview && isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading listing operations...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Listings Operations
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Approval queue, map readiness, category health and review quality.
            </p>
          </div>
        </div>
        <Button disabled={isLoading} onClick={() => void loadOverview()} variant="outline">
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {overview && !overview.isEnabled && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Listings Operations is available when a panel has listings and categories.
          </CardContent>
        </Card>
      )}

      {overview?.isEnabled && (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              helper={`${overview.listings.pending} pending approval`}
              icon={ListChecks}
              label="Listings"
              value={overview.listings.total}
            />
            <MetricCard
              helper={`${overview.listings.missingLocation} missing map data`}
              icon={MapPin}
              label="Map Readiness"
              value={overview.maps.ready}
            />
            <MetricCard
              helper={`${overview.media.missing} missing media`}
              icon={ImageIcon}
              label="Media"
              value={overview.media.ready}
            />
            <MetricCard
              helper={`${overview.promotions.promoted} promoted`}
              icon={Megaphone}
              label="Featured"
              value={overview.promotions.featured}
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.85fr)]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Approval Queue</CardTitle>
                {overview.entities.listings && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/${overview.entities.listings}`}>Open Listings</Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.queues.pendingListings.length === 0 && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    No listings are waiting for approval.
                  </div>
                )}
                {overview.queues.pendingListings.map(listing => (
                  <ListingQueueItem
                    key={listing.id}
                    listing={listing}
                    listingsRoute={overview.entities.listings}
                    onRunAction={runAction}
                    updatingKey={updatingKey}
                  />
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardCheck className="h-4 w-4" />
                    Launch Readiness
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-3xl font-semibold">
                      {overview.launchReadiness.score}%
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Listing marketplace readiness based on mobile discovery requirements.
                    </p>
                  </div>
                  {overview.launchReadiness.issues.length === 0 && (
                    <div className="rounded-md border p-3 text-sm text-muted-foreground">
                      No launch blockers found in the current sample.
                    </div>
                  )}
                  {overview.launchReadiness.issues.slice(0, 5).map(issue => (
                    <div className="rounded-md border p-3 text-sm" key={issue.label}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{issue.label}</span>
                        <Badge variant={variantForSeverity(issue.severity)}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <div className="mt-1 text-muted-foreground">{issue.detail}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4" />
                    Map & Media Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ReadinessRow
                    count={overview.maps.missing}
                    label="Listings missing map location"
                  />
                  <ReadinessRow
                    count={overview.media.coverMissing}
                    label="Listings missing cover photo"
                  />
                  <ReadinessRow
                    count={overview.media.galleryMissing}
                    label="Listings missing gallery"
                  />
                  <SmallStat label="Lat/lng listings" value={overview.maps.withLatLng} />
                  <SmallStat label="GeoPoint listings" value={overview.maps.withCoordinate} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserRound className="h-4 w-4" />
                    Owner Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ReadinessRow
                    count={overview.owners.missingAuthor}
                    label="Listings missing owner"
                  />
                  <ReadinessRow
                    count={overview.owners.missingAuthorSnapshot}
                    label="Listings missing author snapshot"
                  />
                  <SmallStat label="Unique owners" value={overview.owners.uniqueAuthors} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Catalog Setup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SmallStat label="Filters" value={overview.filters.total} />
                  <SmallStat label="Saved listings" value={overview.savedListings.total} />
                  <SmallStat label="Average rating" value={overview.reviews.averageRating} />
                  <ReadinessRow
                    count={overview.listings.missingCategory}
                    label="Listings missing category"
                  />
                  <ReadinessRow
                    count={overview.filters.missingOptions + overview.filters.orphaned}
                    label="Filter configuration issues"
                  />
                  <ReadinessRow
                    count={overview.categories.missingMedia + overview.categories.missingOrder}
                    label="Category setup issues"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {overview.entities.categories && (
                      <Button asChild className="w-full" variant="outline">
                        <Link href={`/admin/${overview.entities.categories}`}>Categories</Link>
                      </Button>
                    )}
                    {overview.entities.filters && (
                      <Button asChild className="w-full" variant="outline">
                        <Link href={`/admin/${overview.entities.filters}`}>Filters</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-4 w-4" />
                    Curation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SmallStat label="Featured" value={overview.promotions.featured} />
                  <SmallStat label="Promoted" value={overview.promotions.promoted} />
                  {overview.promotions.candidates.length === 0 && (
                    <div className="rounded-md border p-3 text-sm text-muted-foreground">
                      No promotion candidates found.
                    </div>
                  )}
                  {overview.promotions.candidates.slice(0, 4).map(listing => (
                    <div className="rounded-md border p-3 text-sm" key={listing.id}>
                      <div className="truncate font-medium">{listing.title}</div>
                      <div className="text-muted-foreground">
                        {listing.category} · {listing.starCount} stars · {listing.savedCount} saves
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Low-Rated Reviews</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.queues.lowRatedReviews.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      No low-rated reviews found.
                    </div>
                  )}
                  {overview.queues.lowRatedReviews.map(review => (
                    <div className="rounded-md border p-3 text-sm" key={review.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium">
                          {review.listingID || 'Listing'}
                        </span>
                        <Badge variant="secondary">{review.starCount}</Badge>
                      </div>
                      {review.content && (
                        <p className="mt-2 line-clamp-3 text-muted-foreground">
                          {review.content}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Listings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              {overview.listings.recent.map(listing => (
                <ListingQueueItem
                  key={listing.id}
                  listing={listing}
                  listingsRoute={overview.entities.listings}
                  onRunAction={runAction}
                  updatingKey={updatingKey}
                />
              ))}
              {overview.listings.recent.length === 0 && (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No listings found.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function ListingQueueItem({
  listing,
  listingsRoute,
  onRunAction,
  updatingKey,
}: {
  listing: ListingSummary
  listingsRoute?: string
  onRunAction: (listingId: string, action: string) => Promise<void>
  updatingKey: string | null
}) {
  const isApproved = listing.isApproved === true
  const featureAction = listing.isFeatured ? 'unfeature' : 'feature'
  const promotionAction = listing.isPromoted ? 'unpromote' : 'promote'

  return (
    <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[4rem_minmax(0,1fr)]">
      <div className="h-16 w-16 overflow-hidden rounded-md border bg-muted">
        {listing.photo ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            src={listing.photo}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {listingsRoute ? (
              <Link
                className="truncate font-medium hover:underline"
                href={`/admin/${listingsRoute}/${encodeURIComponent(listing.id)}/view`}
              >
                {listing.title}
              </Link>
            ) : (
              <span className="truncate font-medium">{listing.title}</span>
            )}
            <Badge variant={isApproved ? 'default' : 'secondary'}>
              {isApproved ? 'Approved' : listing.isApproved === false ? 'Pending' : 'Needs state'}
            </Badge>
            {listing.isFeatured && <Badge variant="outline">Featured</Badge>}
            {listing.isPromoted && <Badge variant="outline">Promoted</Badge>}
          </div>
          <div className="mt-1 truncate text-sm text-muted-foreground">
            {listing.category}
            {' / '}
            {listing.place}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{listing.author}</span>
            {listing.price && <span>{listing.price}</span>}
            {listing.starCount > 0 && <span>{listing.starCount} stars</span>}
            <span>{listing.reviewCount} reviews</span>
            <span>{listing.savedCount} saves</span>
          </div>
          {listing.issues.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {listing.issues.map(issue => (
                <Badge key={issue} variant="destructive">
                  {issue}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isApproved && (
            <Button
              disabled={Boolean(updatingKey)}
              onClick={() => void onRunAction(listing.id, 'approve')}
              size="sm"
            >
              {updatingKey === `${listing.id}:approve` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve
            </Button>
          )}
          {isApproved && (
            <Button
              disabled={Boolean(updatingKey)}
              onClick={() => void onRunAction(listing.id, 'hide')}
              size="sm"
              variant="outline"
            >
              {updatingKey === `${listing.id}:hide` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              Hide
            </Button>
          )}
          <Button
            disabled={Boolean(updatingKey)}
            onClick={() => void onRunAction(listing.id, featureAction)}
            size="sm"
            variant={listing.isFeatured ? 'outline' : 'secondary'}
          >
            {updatingKey === `${listing.id}:${featureAction}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star className="h-4 w-4" />
            )}
            {listing.isFeatured ? 'Unfeature' : 'Feature'}
          </Button>
          <Button
            disabled={Boolean(updatingKey)}
            onClick={() => void onRunAction(listing.id, promotionAction)}
            size="sm"
            variant={listing.isPromoted ? 'outline' : 'secondary'}
          >
            {updatingKey === `${listing.id}:${promotionAction}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Megaphone className="h-4 w-4" />
            )}
            {listing.isPromoted ? 'Unpromote' : 'Promote'}
          </Button>
          <Button
            disabled={Boolean(updatingKey)}
            onClick={() => void onRunAction(listing.id, 'recalculate_rating')}
            size="sm"
            variant="outline"
          >
            {updatingKey === `${listing.id}:recalculate_rating` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star className="h-4 w-4" />
            )}
            Rating
          </Button>
          <Button
            disabled={Boolean(updatingKey)}
            onClick={() => void onRunAction(listing.id, 'clear_saved_references')}
            size="sm"
            variant="outline"
          >
            {updatingKey === `${listing.id}:clear_saved_references` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Filter className="h-4 w-4" />
            )}
            Clear saves
          </Button>
        </div>
      </div>
    </div>
  )
}

function variantForSeverity(severity: ListingLaunchIssue['severity']) {
  if (severity === 'high') {
    return 'destructive'
  }

  if (severity === 'medium') {
    return 'secondary'
  }

  return 'outline'
}

function MetricCard({
  helper,
  icon: Icon,
  label,
  value,
}: {
  helper: string
  icon: LucideIcon
  label: string
  value: number
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function ReadinessRow({ count, label }: { count: number; label: string }) {
  const isReady = count === 0

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {isReady ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <ListChecks className="h-4 w-4 text-destructive" />
        )}
        <span className="truncate">{label}</span>
      </div>
      <Badge variant={isReady ? 'default' : 'destructive'}>{count}</Badge>
    </div>
  )
}
