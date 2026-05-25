import 'server-only'

import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { getDocumentRef } from './firestore-crud-utils'
import { HttpError } from './http'

const sampleLimit = 500
const listingMobileApps = new Set(['realEstate', 'storeLocator', 'ulistings'])
const listingActions = new Set([
  'approve',
  'hide',
  'feature',
  'unfeature',
  'promote',
  'unpromote',
  'recalculate_rating',
  'clear_saved_references',
])

export interface ListingSummary {
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

export interface ListingReviewSummary {
  content: string
  id: string
  listingID: string
  starCount: number
}

export interface ListingCategorySummary {
  id: string
  issues: string[]
  name: string
  order: string
  totalListings: number
}

export interface ListingFilterSummary {
  categories: string[]
  id: string
  issues: string[]
  name: string
  optionsCount: number
}

export interface ListingLaunchIssue {
  detail: string
  label: string
  severity: 'high' | 'low' | 'medium'
}

export interface ListingOperationsOverview {
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

export async function getListingOperationsOverview(): Promise<ListingOperationsOverview> {
  const entities = getListingEntities()

  if (!isListingOperationsPanel(entities)) {
    return emptyOverview(false, entities)
  }

  const [
    listingRows,
    categoryRows,
    filterRows,
    reviewRows,
    savedRows,
    listingCount,
    categoryCount,
    filterCount,
    reviewCount,
    savedListingCount,
  ] = await Promise.all([
    entities.listings ? listEntityRows(entities.listings) : Promise.resolve([]),
    entities.categories ? listEntityRows(entities.categories) : Promise.resolve([]),
    entities.filters ? listEntityRows(entities.filters) : Promise.resolve([]),
    entities.reviews ? listEntityRows(entities.reviews) : Promise.resolve([]),
    entities.savedListings ? listEntityRows(entities.savedListings) : Promise.resolve([]),
    countEntityDocs(entities.listings),
    countEntityDocs(entities.categories),
    countEntityDocs(entities.filters),
    countEntityDocs(entities.reviews),
    countEntityDocs(entities.savedListings),
  ])
  const categoryIds = new Set(categoryRows.map(row => readString(row.id)).filter(Boolean))
  const reviewCountByListing = countRowsByField(reviewRows, 'listingID')
  const savedCountByListing = countRowsByField(savedRows, 'listingID')
  const listingSummaries = listingRows.map(row =>
    buildListingSummary(row, categoryRows, reviewCountByListing, savedCountByListing),
  )
  const reviewSummaries = reviewRows.map(buildReviewSummary)
  const categorySummaries = categoryRows.map(row => buildCategorySummary(row, listingRows))
  const filterSummaries = filterRows.map(row => buildFilterSummary(row, categoryIds))
  const launchIssues = buildLaunchIssues({
    categories: categorySummaries,
    filters: filterSummaries,
    listings: listingSummaries,
    totalCategories: categoryCount,
    totalListings: listingCount,
  })

  return {
    categories: {
      readinessIssues: categorySummaries.filter(category => category.issues.length > 0).slice(0, 12),
      recent: categorySummaries.slice(0, 10),
      missingMedia: categoryRows.filter(row => !hasMedia(row.photo)).length,
      missingOrder: categoryRows.filter(row => !readString(row.order)).length,
      total: categoryCount,
    },
    entities: serializeListingEntities(entities),
    filters: {
      missingOptions: filterSummaries.filter(filter => filter.optionsCount === 0).length,
      orphaned: filterSummaries.filter(filter =>
        filter.issues.some(issue => issue === 'References missing category'),
      ).length,
      readinessIssues: filterSummaries.filter(filter => filter.issues.length > 0).slice(0, 12),
      total: filterCount,
    },
    isEnabled: true,
    launchReadiness: {
      issues: launchIssues,
      score: scoreLaunchReadiness(launchIssues),
    },
    listings: {
      approved: listingRows.filter(row => row.isApproved === true).length,
      featured: listingSummaries.filter(listing => listing.isFeatured).length,
      missingApproval: listingRows.filter(row => typeof row.isApproved !== 'boolean').length,
      missingCategory: listingRows.filter(row => !readString(row.categoryID)).length,
      missingLocation: listingRows.filter(row => !hasLocation(row)).length,
      missingMedia: listingRows.filter(row => !hasListingMedia(row)).length,
      promoted: listingSummaries.filter(listing => listing.isPromoted).length,
      pending: listingRows.filter(row => row.isApproved === false).length,
      recent: listingSummaries
        .slice()
        .sort((left, right) => readTime(findRow(listingRows, right.id)?.createdAt) -
          readTime(findRow(listingRows, left.id)?.createdAt))
        .slice(0, 12),
      readinessIssues: listingSummaries.filter(listing => listing.issues.length > 0).slice(0, 12),
      total: listingCount,
    },
    maps: {
      missing: listingRows.filter(row => !hasLocation(row)).length,
      ready: listingRows.filter(row => hasLocation(row)).length,
      withCoordinate: listingRows.filter(row => hasCoordinate(row)).length,
      withLatLng: listingRows.filter(row => hasLatLngFields(row)).length,
    },
    media: {
      coverMissing: listingRows.filter(row => !hasMedia(row.photo)).length,
      galleryMissing: listingRows.filter(row => !hasMedia(row.photos ?? row.photoURLs)).length,
      missing: listingRows.filter(row => !hasListingMedia(row)).length,
      ready: listingRows.filter(row => hasListingMedia(row)).length,
    },
    owners: {
      missingAuthor: listingRows.filter(row => !readString(row.authorID)).length,
      missingAuthorSnapshot: listingRows.filter(row => !row.author && !readString(row.authorName)).length,
      uniqueAuthors: new Set(listingRows.map(row => readString(row.authorID)).filter(Boolean)).size,
    },
    promotions: {
      candidates: listingSummaries
        .filter(listing =>
          listing.isApproved === true &&
          !listing.isFeatured &&
          !listing.isPromoted &&
          listing.starCount >= 4 &&
          listing.issues.length === 0,
        )
        .slice(0, 8),
      featured: listingSummaries.filter(listing => listing.isFeatured).length,
      promoted: listingSummaries.filter(listing => listing.isPromoted).length,
    },
    queues: {
      mapIssues: listingSummaries
        .filter(listing => listing.issues.includes('Missing map location'))
        .slice(0, 12),
      mediaIssues: listingSummaries
        .filter(listing => listing.issues.includes('Missing listing media'))
        .slice(0, 12),
      lowRatedReviews: reviewSummaries
        .filter(review => review.starCount > 0 && review.starCount <= 2)
        .slice(0, 12),
      pendingListings: listingSummaries
        .filter(listing => listing.isApproved === false)
        .slice(0, 12),
    },
    reviews: {
      averageRating: average(
        reviewRows.map(row => readNumber(row.starCount)).filter(value => value > 0),
      ),
      lowRated: reviewRows.filter(row => {
        const rating = readNumber(row.starCount)
        return rating > 0 && rating <= 2
      }).length,
      total: reviewCount,
    },
    savedListings: {
      total: savedListingCount,
    },
  }
}

export async function runListingOperationAction(
  id: string,
  action: string,
  actor: AdminSessionUser,
) {
  const entities = getListingEntities()

  if (!entities.listings || !isListingOperationsPanel(entities)) {
    throw new HttpError('Listing Operations is not enabled for this panel.', 404)
  }

  if (!listingActions.has(action)) {
    throw new HttpError('Unsupported listing operation action.', 400)
  }

  const ref = getDocumentRef(entities.listings, id)
  const snapshot = await ref.get()

  if (!snapshot.exists) {
    throw new HttpError('Listing was not found.', 404)
  }

  const patch: Record<string, unknown> = {
    adminUpdatedAt: Date.now(),
    adminUpdatedBy: actor.uid,
    updatedAt: Date.now(),
  }
  const metadata: Record<string, unknown> = { action }

  if (action === 'approve') {
    patch.isApproved = true
  }

  if (action === 'hide') {
    patch.isApproved = false
  }

  if (action === 'feature') {
    patch.featured = true
    patch.isFeatured = true
  }

  if (action === 'unfeature') {
    patch.featured = false
    patch.isFeatured = false
  }

  if (action === 'promote') {
    patch.isPromoted = true
    patch.promoted = true
  }

  if (action === 'unpromote') {
    patch.isPromoted = false
    patch.promoted = false
  }

  if (action === 'recalculate_rating') {
    const starCount = await calculateListingRating(id, entities.reviews)
    patch.starCount = starCount
    metadata.starCount = starCount
  }

  if (action === 'clear_saved_references') {
    const deletedSavedReferences = await clearSavedListingReferences(id, entities.savedListings)
    metadata.deletedSavedReferences = deletedSavedReferences
  }

  if (Object.keys(patch).length > 3) {
    await ref.set(patch, { merge: true })
  }

  await writeAuditLog({
    action: `listings.${action}`,
    actor,
    metadata,
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entities.listings.key,
  })

  return {
    action,
    id,
    success: true,
    ...metadata,
  }
}

function getListingEntities() {
  return {
    categories: findEntity(['categories']),
    filters: findEntity(['filters']),
    listings: findEntity(['listings']),
    reviews: findEntity(['reviews']),
    savedListings: findEntity(['savedListings', 'saved_listings']),
  }
}

function isListingOperationsPanel(entities: ReturnType<typeof getListingEntities>) {
  return (
    listingMobileApps.has(adminPanelConfig.mobileApp) ||
    Boolean(entities.listings && entities.categories)
  )
}

async function listEntityRows(entity: AdminEntityConfig, limit = sampleLimit) {
  const db = getFirebaseAdminFirestore()
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
    db.collection(entity.collection)

  if (entity.orderBy) {
    query = query.orderBy(entity.orderBy.field, entity.orderBy.direction)
  }

  const snapshot = await query.limit(limit).get()
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
  }) as Record<string, unknown>)
}

async function countEntityDocs(entity: AdminEntityConfig | undefined) {
  if (!entity) {
    return 0
  }

  const collection = getFirebaseAdminFirestore().collection(entity.collection)

  try {
    const snapshot = await collection.count().get()
    return snapshot.data().count
  } catch {
    return (await collection.limit(sampleLimit).get()).size
  }
}

async function calculateListingRating(
  listingId: string,
  reviewsEntity: AdminEntityConfig | undefined,
) {
  if (!reviewsEntity) {
    return 0
  }

  const snapshot = await getFirebaseAdminFirestore()
    .collection(reviewsEntity.collection)
    .where('listingID', '==', listingId)
    .limit(sampleLimit)
    .get()
  const ratings = snapshot.docs
    .map(doc => readNumber(doc.data().starCount))
    .filter(value => value > 0)

  return average(ratings)
}

async function clearSavedListingReferences(
  listingId: string,
  savedListingsEntity: AdminEntityConfig | undefined,
) {
  if (!savedListingsEntity) {
    return 0
  }

  const snapshot = await getFirebaseAdminFirestore()
    .collection(savedListingsEntity.collection)
    .where('listingID', '==', listingId)
    .limit(sampleLimit)
    .get()
  const batch = getFirebaseAdminFirestore().batch()

  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref)
  })

  if (snapshot.empty) {
    return 0
  }

  await batch.commit()
  return snapshot.size
}

function buildListingSummary(
  row: Record<string, unknown>,
  categoryRows: Array<Record<string, unknown>>,
  reviewCountByListing: Map<string, number>,
  savedCountByListing: Map<string, number>,
): ListingSummary {
  const categoryID = readString(row.categoryID)
  const id = readString(row.id)
  const category = categoryRows.find(item => readString(item.id) === categoryID)
  const issues: string[] = []

  if (typeof row.isApproved !== 'boolean') {
    issues.push('Missing approval state')
  }

  if (!categoryID) {
    issues.push('Missing category')
  }

  if (!readString(row.authorID)) {
    issues.push('Missing owner')
  }

  if (!hasLocation(row)) {
    issues.push('Missing map location')
  }

  if (!hasListingMedia(row)) {
    issues.push('Missing listing media')
  }

  if (!readString(row.price)) {
    issues.push('Missing price')
  }

  return {
    author: readString(row.authorName) ||
      readNestedName(row.author) ||
      readString(row.authorID) ||
      'Unknown author',
    category: readString(row.categoryTitle) ||
      readString(category?.name) ||
      readString(category?.title) ||
      categoryID ||
      'Uncategorized',
    id,
    isApproved: typeof row.isApproved === 'boolean' ? row.isApproved : null,
    isFeatured: row.isFeatured === true || row.featured === true,
    isPromoted: row.isPromoted === true || row.promoted === true,
    issues,
    photo: readString(row.photo) || readFirstString(row.photos) || readFirstString(row.photoURLs),
    place: readString(row.place) || readString(row.location) || 'No place',
    price: readString(row.price),
    reviewCount: reviewCountByListing.get(id) ?? 0,
    savedCount: savedCountByListing.get(id) ?? 0,
    starCount: readNumber(row.starCount),
    title: readString(row.title) || readString(row.name) || 'Untitled listing',
  }
}

function buildCategorySummary(
  row: Record<string, unknown>,
  listingRows: Array<Record<string, unknown>>,
): ListingCategorySummary {
  const id = readString(row.id)
  const issues: string[] = []

  if (!readString(row.name) && !readString(row.title)) {
    issues.push('Missing category name')
  }

  if (!hasMedia(row.photo)) {
    issues.push('Missing category media')
  }

  if (!readString(row.order)) {
    issues.push('Missing display order')
  }

  return {
    id,
    issues,
    name: readString(row.name) || readString(row.title) || 'Category',
    order: readString(row.order),
    totalListings: listingRows.filter(listing => readString(listing.categoryID) === id).length,
  }
}

function buildFilterSummary(
  row: Record<string, unknown>,
  categoryIds: Set<string>,
): ListingFilterSummary {
  const categories = readForeignKeyArray(row.categories)
  const issues: string[] = []
  const optionsCount = readOptionCount(row.options)

  if (!readString(row.name)) {
    issues.push('Missing filter name')
  }

  if (optionsCount === 0) {
    issues.push('Missing filter options')
  }

  if (categories.some(categoryId => !categoryIds.has(categoryId))) {
    issues.push('References missing category')
  }

  return {
    categories,
    id: readString(row.id),
    issues,
    name: readString(row.name) || 'Filter',
    optionsCount,
  }
}

function buildReviewSummary(row: Record<string, unknown>): ListingReviewSummary {
  return {
    content: readString(row.content),
    id: readString(row.id),
    listingID: readString(row.listingID),
    starCount: readNumber(row.starCount),
  }
}

function buildLaunchIssues({
  categories,
  filters,
  listings,
  totalCategories,
  totalListings,
}: {
  categories: ListingCategorySummary[]
  filters: ListingFilterSummary[]
  listings: ListingSummary[]
  totalCategories: number
  totalListings: number
}): ListingLaunchIssue[] {
  const issues: ListingLaunchIssue[] = []
  const pendingListings = listings.filter(listing => listing.isApproved === false).length
  const missingMap = listings.filter(listing => listing.issues.includes('Missing map location')).length
  const missingMedia = listings.filter(listing => listing.issues.includes('Missing listing media')).length
  const missingOwner = listings.filter(listing => listing.issues.includes('Missing owner')).length
  const categoryIssues = categories.filter(category => category.issues.length > 0).length
  const filterIssues = filters.filter(filter => filter.issues.length > 0).length

  if (totalCategories === 0) {
    issues.push({
      detail: 'Mobile discovery is category-first, so seed at least one category before launch.',
      label: 'No listing categories',
      severity: 'high',
    })
  }

  if (totalListings === 0) {
    issues.push({
      detail: 'Add seed listings so customers see useful marketplace content on first launch.',
      label: 'No listings',
      severity: 'high',
    })
  }

  if (pendingListings > 0) {
    issues.push({
      detail: `${pendingListings} listings are waiting for approval and will not show in approved feeds.`,
      label: 'Pending approval queue',
      severity: 'medium',
    })
  }

  if (missingMap > 0) {
    issues.push({
      detail: `${missingMap} listings are missing valid coordinates used by map views.`,
      label: 'Map readiness gaps',
      severity: 'medium',
    })
  }

  if (missingMedia > 0) {
    issues.push({
      detail: `${missingMedia} listings are missing cover/gallery media.`,
      label: 'Media readiness gaps',
      severity: 'medium',
    })
  }

  if (missingOwner > 0) {
    issues.push({
      detail: `${missingOwner} listings are missing authorID, which breaks owner dashboards and support workflows.`,
      label: 'Owner assignment gaps',
      severity: 'medium',
    })
  }

  if (categoryIssues > 0 || filterIssues > 0) {
    issues.push({
      detail: `${categoryIssues} categories and ${filterIssues} filters need cleanup for mobile filtering.`,
      label: 'Category/filter setup gaps',
      severity: 'low',
    })
  }

  return issues
}

function scoreLaunchReadiness(issues: ListingLaunchIssue[]) {
  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === 'high') {
      return sum + 20
    }

    if (issue.severity === 'medium') {
      return sum + 10
    }

    return sum + 5
  }, 0)

  return Math.max(0, 100 - penalty)
}

function countRowsByField(rows: Array<Record<string, unknown>>, field: string) {
  const counts = new Map<string, number>()

  rows.forEach(row => {
    const value = readString(row[field])

    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  })

  return counts
}

function emptyOverview(
  isEnabled: boolean,
  entities: ReturnType<typeof getListingEntities>,
): ListingOperationsOverview {
  return {
    categories: {
      readinessIssues: [],
      recent: [],
      missingMedia: 0,
      missingOrder: 0,
      total: 0,
    },
    entities: serializeListingEntities(entities),
    filters: {
      missingOptions: 0,
      orphaned: 0,
      readinessIssues: [],
      total: 0,
    },
    isEnabled,
    launchReadiness: {
      issues: [],
      score: 0,
    },
    listings: {
      approved: 0,
      featured: 0,
      missingApproval: 0,
      missingCategory: 0,
      missingLocation: 0,
      missingMedia: 0,
      promoted: 0,
      pending: 0,
      recent: [],
      readinessIssues: [],
      total: 0,
    },
    maps: {
      missing: 0,
      ready: 0,
      withCoordinate: 0,
      withLatLng: 0,
    },
    media: {
      coverMissing: 0,
      galleryMissing: 0,
      missing: 0,
      ready: 0,
    },
    owners: {
      missingAuthor: 0,
      missingAuthorSnapshot: 0,
      uniqueAuthors: 0,
    },
    promotions: {
      candidates: [],
      featured: 0,
      promoted: 0,
    },
    queues: {
      mapIssues: [],
      mediaIssues: [],
      lowRatedReviews: [],
      pendingListings: [],
    },
    reviews: {
      averageRating: 0,
      lowRated: 0,
      total: 0,
    },
    savedListings: {
      total: 0,
    },
  }
}

function serializeListingEntities(entities: ReturnType<typeof getListingEntities>) {
  return {
    categories: entities.categories?.route,
    filters: entities.filters?.route,
    listings: entities.listings?.route,
    reviews: entities.reviews?.route,
    savedListings: entities.savedListings?.route,
  }
}

function findEntity(keys: string[]) {
  return adminPanelConfig.entities.find(entity => {
    return keys.includes(entity.key) || keys.includes(entity.route)
  })
}

function findRow(rows: Array<Record<string, unknown>>, id: string) {
  return rows.find(row => readString(row.id) === id)
}

function hasLocation(row: Record<string, unknown>) {
  const lat = readNumber(row.latitude)
  const lng = readNumber(row.longitude)

  if (isValidLatLng(lat, lng)) {
    return true
  }

  if (!row.coordinate || typeof row.coordinate !== 'object' || Array.isArray(row.coordinate)) {
    return false
  }

  const coordinate = row.coordinate as Record<string, unknown>
  return isValidLatLng(
    readNumber(coordinate.latitude ?? coordinate._latitude),
    readNumber(coordinate.longitude ?? coordinate._longitude),
  )
}

function hasLatLngFields(row: Record<string, unknown>) {
  return isValidLatLng(readNumber(row.latitude), readNumber(row.longitude))
}

function hasCoordinate(row: Record<string, unknown>) {
  if (!row.coordinate || typeof row.coordinate !== 'object' || Array.isArray(row.coordinate)) {
    return false
  }

  const coordinate = row.coordinate as Record<string, unknown>
  return isValidLatLng(
    readNumber(coordinate.latitude ?? coordinate._latitude),
    readNumber(coordinate.longitude ?? coordinate._longitude),
  )
}

function isValidLatLng(latitude: number, longitude: number) {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
}

function hasMedia(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.some((item): boolean => hasMedia(item))
  }

  return Boolean(value)
}

function hasListingMedia(row: Record<string, unknown>) {
  return hasMedia(row.photo) || hasMedia(row.photos) || hasMedia(row.photoURLs)
}

function readNestedName(value: unknown) {
  const firstName = readNestedString(value, 'firstName')
  const lastName = readNestedString(value, 'lastName')
  return [firstName, lastName].filter(Boolean).join(' ') ||
    readNestedString(value, 'email') ||
    readNestedString(value, 'name')
}

function readNestedString(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  return readString((value as Record<string, unknown>)[key])
}

function readFirstString(value: unknown) {
  if (!Array.isArray(value)) {
    return ''
  }

  return value.map(readString).find(Boolean) ?? ''
}

function readForeignKeyArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => {
      if (typeof item === 'string' || typeof item === 'number') {
        return readString(item)
      }

      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const row = item as Record<string, unknown>
        return readString(row.id ?? row.value ?? row.key)
      }

      return ''
    })
    .filter(Boolean)
}

function readOptionCount(value: unknown) {
  if (Array.isArray(value)) {
    return value.length
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).length
  }

  if (typeof value === 'string') {
    return value.trim().length > 0 ? 1 : 0
  }

  return 0
}

function readString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function readTime(value: unknown) {
  const date = parseDate(value)
  return date?.getTime() ?? 0
}

function parseDate(value: unknown): Date | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const date = new Date(value < 100000000000 ? value * 1000 : value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    return date && !Number.isNaN(date.getTime()) ? date : null
  }

  if (typeof value === 'object' && '_seconds' in value) {
    const seconds = readNumber((value as { _seconds?: unknown })._seconds)
    const date = new Date(seconds * 1000)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}
