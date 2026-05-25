import 'server-only'

import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { getDocumentRef } from './firestore-crud-utils'
import { HttpError } from './http'

const sampleLimit = 500
const appointmentMobileApps = new Set([
  'appointmentsAllInOne',
  'appointmentsConsumer',
  'appointmentsProfessional',
  'appointmentsVendorManager',
])

export interface AppointmentBookingSummary {
  adminAvailabilityHold: boolean
  appointmentAt?: string
  customer: string
  id: string
  professional: string
  provider: string
  status: string
  time: string
  type: string
}

export interface AppointmentProfessionalSummary {
  category: string
  email: string
  id: string
  isFeatured: boolean
  issues: string[]
  name: string
  price: string
  provider: string
  specialty: string
}

export interface AppointmentLaunchIssue {
  detail: string
  label: string
  severity: 'high' | 'low' | 'medium'
}

export interface ProviderReadinessIssue {
  id: string
  issue: string
  title: string
}

export interface AppointmentOperationsOverview {
  availability: {
    blockedSlots: AppointmentBookingSummary[]
    defaultSlots: string[]
    fullyBookedDays: Array<{ date: string; professional: string }>
    nextOpenSlots: Array<{ date: string; professional: string; professionalId: string; time: string }>
  }
  bookings: {
    canceled: number
    completed: number
    pending: number
    recent: AppointmentBookingSummary[]
    statusCounts: Array<{ count: number; status: string }>
    today: number
    total: number
    upcoming: number
  }
  entities: {
    bookings?: string
    categories?: string
    providers?: string
    reviews?: string
    users?: string
  }
  isEnabled: boolean
  launchReadiness: {
    issues: AppointmentLaunchIssue[]
    score: number
  }
  noShows: {
    count: number
    recent: AppointmentBookingSummary[]
  }
  professionals: {
    featured: number
    readinessIssues: AppointmentProfessionalSummary[]
    recent: AppointmentProfessionalSummary[]
    total: number
    withoutCategory: number
    withoutPhoto: number
    withoutPrice: number
    withoutSkills: number
    withoutProvider: number
  }
  providers: {
    categories: number
    readinessIssues: ProviderReadinessIssue[]
    reviews: number
    total: number
    withoutCategory: number
    withoutLocation: number
    withoutPhoto: number
    withoutPrice: number
  }
  reminders: {
    needsReminder: AppointmentBookingSummary[]
    next24h: number
    rescheduledUpcoming: number
    unconfirmedUpcoming: number
  }
  schedule: Array<{
    date: string
    items: AppointmentBookingSummary[]
  }>
  statusOptions: string[]
}

export async function getAppointmentOperationsOverview(): Promise<AppointmentOperationsOverview> {
  const entities = getAppointmentEntities()

  if (!isAppointmentOperationsPanel(entities)) {
    return emptyOverview(false, entities)
  }

  const [
    bookingRows,
    providerRows,
    bookingsCount,
    providersCount,
    categoriesCount,
    reviewsCount,
    userRows,
  ] = await Promise.all([
    entities.bookings ? listEntityRows(entities.bookings) : Promise.resolve([]),
    entities.providers ? listEntityRows(entities.providers) : Promise.resolve([]),
    countEntityDocs(entities.bookings),
    countEntityDocs(entities.providers),
    countEntityDocs(entities.categories),
    countEntityDocs(entities.reviews),
    entities.users ? listEntityRows(entities.users) : Promise.resolve([]),
  ])
  const recentBookings = bookingRows
    .slice()
    .sort((left, right) => readTime(readBookingDate(right)) - readTime(readBookingDate(left)))
    .slice(0, 12)
    .map(row => buildBookingSummary(row))
  const schedule = buildSchedule(bookingRows)
  const providerIssues = buildProviderIssues(providerRows)
  const professionalRows = userRows.filter(row => readString(row.role) === 'professional')
  const professionalSummaries = professionalRows.map(buildProfessionalSummary)
  const upcomingRows = bookingRows.filter(isUpcomingBooking)
  const noShowRows = bookingRows
    .filter(isNoShowCandidate)
    .sort((left, right) => readTime(readBookingDate(right)) - readTime(readBookingDate(left)))
  const reminders = buildReminderSummary(upcomingRows)
  const providersWithoutCategory = providerRows.filter(provider => !readString(provider.categoryID)).length
  const availability = buildAvailabilitySummary(professionalSummaries, bookingRows)
  const launchIssues = buildLaunchIssues({
    bookings: bookingRows,
    categoriesCount,
    professionals: professionalSummaries,
    providerIssues,
    providersCount,
    providersWithoutCategory,
    reminders,
  })

  return {
    availability,
    bookings: {
      canceled: bookingRows.filter(row => isCanceledStatus(readStatus(row))).length,
      completed: bookingRows.filter(row => isCompletedStatus(readStatus(row))).length,
      pending: bookingRows.filter(row => isPendingStatus(readStatus(row))).length,
      recent: recentBookings,
      statusCounts: countByStatus(bookingRows),
      today: bookingRows.filter(isTodayBooking).length,
      total: bookingsCount,
      upcoming: upcomingRows.length,
    },
    entities: serializeAppointmentEntities(entities),
    isEnabled: true,
    launchReadiness: {
      issues: launchIssues,
      score: scoreLaunchReadiness(launchIssues),
    },
    noShows: {
      count: noShowRows.length,
      recent: noShowRows.slice(0, 8).map(row => buildBookingSummary(row)),
    },
    professionals: {
      featured: professionalSummaries.filter(professional => professional.isFeatured).length,
      readinessIssues: professionalSummaries
        .filter(professional => professional.issues.length > 0)
        .slice(0, 12),
      recent: professionalSummaries.slice(0, 10),
      total: professionalSummaries.length,
      withoutCategory: professionalSummaries.filter(professional => !professional.category).length,
      withoutPhoto: professionalSummaries.filter(professional =>
        professional.issues.includes('Missing profile photo'),
      ).length,
      withoutPrice: professionalSummaries.filter(professional => !professional.price).length,
      withoutProvider: professionalSummaries.filter(professional => !professional.provider).length,
      withoutSkills: professionalSummaries.filter(professional =>
        professional.issues.includes('Missing services or skills'),
      ).length,
    },
    providers: {
      categories: categoriesCount,
      readinessIssues: providerIssues.slice(0, 12),
      reviews: reviewsCount,
      total: providersCount,
      withoutCategory: providersWithoutCategory,
      withoutLocation: providerRows.filter(provider => !hasLocation(provider)).length,
      withoutPhoto: providerRows.filter(provider => !hasMedia(provider.photo ?? provider.photos ?? provider.photoURLs)).length,
      withoutPrice: providerRows.filter(provider => !readString(provider.price)).length,
    },
    reminders,
    schedule,
    statusOptions: getStatusOptions(entities.bookings),
  }
}

export async function blockAppointmentAvailabilitySlot({
  date,
  professionalId,
  time,
}: {
  date: string
  professionalId: string
  time: string
}, actor: AdminSessionUser) {
  const entities = getAppointmentEntities()

  if (!entities.bookings || !entities.users || !isAppointmentOperationsPanel(entities)) {
    throw new HttpError('Appointment Operations is not enabled for this panel.', 404)
  }

  const formattedDate = formatAppointmentDate(date)

  if (!formattedDate) {
    throw new HttpError('A valid appointment date is required.', 400)
  }

  if (!defaultAppointmentSlots().includes(time)) {
    throw new HttpError('Unsupported appointment time slot.', 400)
  }

  const professionalRef = getDocumentRef(entities.users, professionalId)
  const professionalSnapshot = await professionalRef.get()
  const professional = professionalSnapshot.data()

  if (!professionalSnapshot.exists || readString(professional?.role) !== 'professional') {
    throw new HttpError('Professional was not found.', 404)
  }

  const selectedDate = buildSelectedDate(date, time)
  const existing = await getFirebaseAdminFirestore()
    .collection(entities.bookings.collection)
    .where('professionalId', '==', professionalId)
    .where('formattedDate', '==', formattedDate)
    .where('appointmentTime', '==', time)
    .limit(1)
    .get()

  const activeExisting = existing.docs.find(doc => {
    const row = doc.data()
    return !isCanceledStatus(readStatus(row))
  })

  if (activeExisting) {
    throw new HttpError('This appointment slot is already blocked or booked.', 409)
  }

  const ref = getFirebaseAdminFirestore().collection(entities.bookings.collection).doc()
  const professionalName = buildProfessionalName(professional ?? {})
  const now = Date.now()

  await ref.set({
    adminAvailabilityHold: true,
    adminCreatedBy: actor.uid,
    appointmentDate: selectedDate,
    appointmentTime: time,
    appointmentType: 'Unavailable',
    authorID: actor.uid,
    createdAt: now,
    customerName: 'Admin hold',
    formattedDate,
    id: ref.id,
    professionalId,
    professionalName,
    recentEditorID: actor.uid,
    selectedDate,
    selectedSkill: 'Unavailable',
    status: 'Confirmed',
    updatedAt: now,
    vendorId: readString(professional?.professionalVendorID),
  })
  await writeAuditLog({
    action: 'appointments.availability_block',
    actor,
    metadata: { date: formattedDate, professionalId, time },
    resourceId: ref.id,
    resourcePath: ref.path,
    resourceType: entities.bookings.key,
  })

  return { id: ref.id, success: true }
}

export async function updateAppointmentBookingStatus(
  id: string,
  status: string,
  actor: AdminSessionUser,
) {
  const entities = getAppointmentEntities()

  if (!entities.bookings || !isAppointmentOperationsPanel(entities)) {
    throw new HttpError('Appointment Operations is not enabled for this panel.', 404)
  }

  const statusOptions = getStatusOptions(entities.bookings)

  if (!statusOptions.includes(status)) {
    throw new HttpError('Unsupported appointment status.', 400)
  }

  const ref = getDocumentRef(entities.bookings, id)
  await ref.set(
    {
      recentEditorID: actor.uid,
      status,
      updatedAt: Date.now(),
    },
    { merge: true },
  )
  await writeAuditLog({
    action: 'appointments.booking_status_update',
    actor,
    metadata: { status },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entities.bookings.key,
  })

  return { id, status, success: true }
}

function getAppointmentEntities() {
  return {
    bookings: findEntity(['bookings']),
    categories: findEntity(['categories']),
    providers: findEntity(['providers']),
    reviews: findEntity(['reviews']),
    users: findEntity(['users']),
  }
}

function isAppointmentOperationsPanel(entities: ReturnType<typeof getAppointmentEntities>) {
  return (
    appointmentMobileApps.has(adminPanelConfig.mobileApp) ||
    Boolean(entities.bookings && entities.providers)
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
    id: doc.id,
    ...doc.data(),
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

function buildBookingSummary(row: Record<string, unknown>): AppointmentBookingSummary {
  return {
    adminAvailabilityHold: row.adminAvailabilityHold === true,
    appointmentAt: serializeDate(readBookingDate(row)),
    customer: readString(row.customerName) || readString(row.authorID) || 'Unknown customer',
    id: readString(row.id),
    professional:
      readString(row.professionalName) || readString(row.professionalId) || 'Unassigned',
    provider: readString(row.vendorId) || readString(row.providerName) || 'No provider',
    status: readStatus(row),
    time: readString(row.appointmentTime) || readString(row.formattedDate) || 'No time',
    type: readString(row.appointmentType) || readString(row.selectedSkill) || 'Appointment',
  }
}

function buildSchedule(rows: Array<Record<string, unknown>>) {
  const upcomingRows = rows
    .filter(row => !isCanceledStatus(readStatus(row)))
    .filter(row => readTime(readBookingDate(row)) >= startOfToday())
    .sort((left, right) => readTime(readBookingDate(left)) - readTime(readBookingDate(right)))
    .slice(0, 30)
  const byDate = new Map<string, AppointmentBookingSummary[]>()

  upcomingRows.forEach(row => {
    const date = parseDate(readBookingDate(row))
    const key = date ? date.toISOString().slice(0, 10) : 'Unscheduled'
    byDate.set(key, [...(byDate.get(key) ?? []), buildBookingSummary(row)])
  })

  return [...byDate.entries()].slice(0, 7).map(([date, items]) => ({
    date,
    items,
  }))
}

function buildProviderIssues(rows: Array<Record<string, unknown>>) {
  return rows.flatMap(row => {
    const id = readString(row.id)
    const title = readString(row.title) || id || 'Provider'
    const issues: ProviderReadinessIssue[] = []

    if (!hasMedia(row.photo ?? row.photos ?? row.photoURLs)) {
      issues.push({ id, issue: 'Missing provider photo', title })
    }

    if (!hasLocation(row)) {
      issues.push({ id, issue: 'Missing location', title })
    }

    if (!readString(row.price)) {
      issues.push({ id, issue: 'Missing service price', title })
    }

    if (!readString(row.categoryID)) {
      issues.push({ id, issue: 'Missing category', title })
    }

    return issues
  })
}

function buildProfessionalSummary(row: Record<string, unknown>): AppointmentProfessionalSummary {
  const id = readString(row.id)
  const name = [readString(row.firstName), readString(row.lastName)].filter(Boolean).join(' ') ||
    readString(row.username) ||
    readString(row.email) ||
    'Professional'
  const category = readString(row.professionalCategoryID)
  const provider = readString(row.professionalVendorID)
  const price = readString(row.pricePerHr)
  const issues: string[] = []

  if (!provider) {
    issues.push('Missing provider assignment')
  }

  if (!category) {
    issues.push('Missing category assignment')
  }

  if (!hasItems(row.professionalSkills)) {
    issues.push('Missing services or skills')
  }

  if (!hasMedia(row.profilePictureURL)) {
    issues.push('Missing profile photo')
  }

  if (!price) {
    issues.push('Missing hourly price')
  }

  return {
    category,
    email: readString(row.email),
    id,
    isFeatured: row.isFeatured === true,
    issues,
    name,
    price,
    provider,
    specialty: readString(row.professionalSpecialty),
  }
}

function buildReminderSummary(rows: Array<Record<string, unknown>>) {
  const now = Date.now()
  const next24hRows = rows.filter(row => {
    const time = readTime(readBookingDate(row))
    return time >= now && time <= now + 24 * 60 * 60 * 1000
  })
  const unconfirmedRows = rows.filter(row => /unconfirmed/i.test(readStatus(row)))
  const rescheduledRows = rows.filter(row => /rescheduled/i.test(readStatus(row)))
  const needsReminder = [...next24hRows, ...unconfirmedRows, ...rescheduledRows]
  const unique = new Map<string, AppointmentBookingSummary>()

  needsReminder.forEach(row => {
    const summary = buildBookingSummary(row)
    unique.set(summary.id, summary)
  })

  return {
    needsReminder: [...unique.values()].slice(0, 10),
    next24h: next24hRows.length,
    rescheduledUpcoming: rescheduledRows.length,
    unconfirmedUpcoming: unconfirmedRows.length,
  }
}

function buildAvailabilitySummary(
  professionals: AppointmentProfessionalSummary[],
  bookingRows: Array<Record<string, unknown>>,
) {
  const slots = defaultAppointmentSlots()
  const nextDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfToday() + index * 24 * 60 * 60 * 1000)
    return {
      date,
      formattedDate: formatDateForMobile(date),
      isoDate: date.toISOString().slice(0, 10),
    }
  })
  const activeBookings = bookingRows.filter(row => !isCanceledStatus(readStatus(row)))
  const blockedSlots = activeBookings
    .filter(row => row.adminAvailabilityHold === true)
    .sort((left, right) => readTime(readBookingDate(left)) - readTime(readBookingDate(right)))
    .slice(0, 10)
    .map(buildBookingSummary)
  const fullyBookedDays: Array<{ date: string; professional: string }> = []
  const nextOpenSlots: Array<{ date: string; professional: string; professionalId: string; time: string }> = []

  professionals.slice(0, 12).forEach(professional => {
    const bookingsForProfessional = activeBookings.filter(row =>
      readString(row.professionalId) === professional.id,
    )

    for (const date of nextDates) {
      const bookedTimes = new Set(
        bookingsForProfessional
          .filter(row => readString(row.formattedDate) === date.formattedDate)
          .map(row => readString(row.appointmentTime))
          .filter(Boolean),
      )
      const openSlot = slots.find(slot => !bookedTimes.has(slot))

      if (!openSlot) {
        fullyBookedDays.push({
          date: date.isoDate,
          professional: professional.name,
        })
        continue
      }

      if (!nextOpenSlots.some(slot => slot.professionalId === professional.id)) {
        nextOpenSlots.push({
          date: date.isoDate,
          professional: professional.name,
          professionalId: professional.id,
          time: openSlot,
        })
      }
      break
    }
  })

  return {
    blockedSlots,
    defaultSlots: slots,
    fullyBookedDays: fullyBookedDays.slice(0, 10),
    nextOpenSlots: nextOpenSlots.slice(0, 10),
  }
}

function buildLaunchIssues({
  categoriesCount,
  professionals,
  providerIssues,
  providersCount,
  providersWithoutCategory,
  reminders,
}: {
  bookings: Array<Record<string, unknown>>
  categoriesCount: number
  professionals: AppointmentProfessionalSummary[]
  providerIssues: ProviderReadinessIssue[]
  providersCount: number
  providersWithoutCategory: number
  reminders: AppointmentOperationsOverview['reminders']
}): AppointmentLaunchIssue[] {
  const issues: AppointmentLaunchIssue[] = []
  const professionalIssues = professionals.filter(professional => professional.issues.length > 0)

  if (categoriesCount === 0) {
    issues.push({
      detail: 'Mobile filters professionals by appointment category, so seed at least one category before launch.',
      label: 'No appointment categories',
      severity: 'high',
    })
  }

  if (providersCount === 0) {
    issues.push({
      detail: 'The customer app expects vendors/providers for service discovery.',
      label: 'No providers configured',
      severity: 'high',
    })
  }

  if (professionals.length === 0) {
    issues.push({
      detail: 'Professionals are users with role "professional" in the mobile source.',
      label: 'No professional users',
      severity: 'high',
    })
  }

  if (providerIssues.length > 0 || providersWithoutCategory > 0) {
    issues.push({
      detail: `${providerIssues.length + providersWithoutCategory} provider setup issues found in the current sample.`,
      label: 'Provider readiness gaps',
      severity: 'medium',
    })
  }

  if (professionalIssues.length > 0) {
    issues.push({
      detail: `${professionalIssues.length} professional profiles are missing provider, category, skills, photo or price.`,
      label: 'Professional profile gaps',
      severity: 'medium',
    })
  }

  if (reminders.unconfirmedUpcoming > 0) {
    issues.push({
      detail: `${reminders.unconfirmedUpcoming} upcoming bookings still need confirmation.`,
      label: 'Bookings waiting confirmation',
      severity: 'medium',
    })
  }

  if (reminders.next24h > 0) {
    issues.push({
      detail: `${reminders.next24h} bookings are scheduled in the next 24 hours.`,
      label: 'Reminder window active',
      severity: 'low',
    })
  }

  return issues
}

function scoreLaunchReadiness(issues: AppointmentLaunchIssue[]) {
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

function countByStatus(rows: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>()

  rows.forEach(row => {
    const status = readStatus(row)
    counts.set(status, (counts.get(status) ?? 0) + 1)
  })

  return [...counts.entries()]
    .map(([status, count]) => ({ count, status }))
    .sort((left, right) => right.count - left.count)
}

function emptyOverview(
  isEnabled: boolean,
  entities: ReturnType<typeof getAppointmentEntities>,
): AppointmentOperationsOverview {
  return {
    availability: {
      blockedSlots: [],
      defaultSlots: defaultAppointmentSlots(),
      fullyBookedDays: [],
      nextOpenSlots: [],
    },
    bookings: {
      canceled: 0,
      completed: 0,
      pending: 0,
      recent: [],
      statusCounts: [],
      today: 0,
      total: 0,
      upcoming: 0,
    },
    entities: serializeAppointmentEntities(entities),
    isEnabled,
    launchReadiness: {
      issues: [],
      score: 0,
    },
    noShows: {
      count: 0,
      recent: [],
    },
    professionals: {
      featured: 0,
      readinessIssues: [],
      recent: [],
      total: 0,
      withoutCategory: 0,
      withoutPhoto: 0,
      withoutPrice: 0,
      withoutProvider: 0,
      withoutSkills: 0,
    },
    providers: {
      categories: 0,
      readinessIssues: [],
      reviews: 0,
      total: 0,
      withoutCategory: 0,
      withoutLocation: 0,
      withoutPhoto: 0,
      withoutPrice: 0,
    },
    reminders: {
      needsReminder: [],
      next24h: 0,
      rescheduledUpcoming: 0,
      unconfirmedUpcoming: 0,
    },
    schedule: [],
    statusOptions: [],
  }
}

function serializeAppointmentEntities(entities: ReturnType<typeof getAppointmentEntities>) {
  return {
    bookings: entities.bookings?.route,
    categories: entities.categories?.route,
    providers: entities.providers?.route,
    reviews: entities.reviews?.route,
    users: entities.users?.route,
  }
}

function findEntity(keys: string[]) {
  return adminPanelConfig.entities.find(entity => {
    return keys.includes(entity.key) || keys.includes(entity.route)
  })
}

function getStatusOptions(entity: AdminEntityConfig | undefined) {
  const statusField = entity?.fields.status

  if (statusField?.type === 'enum' && Array.isArray(statusField.options)) {
    return statusField.options
  }

  return ['Unconfirmed', 'Confirmed', 'Rescheduled', 'Canceled', 'Completed']
}

function isUpcomingBooking(row: Record<string, unknown>) {
  return (
    readTime(readBookingDate(row)) >= startOfToday() &&
    !isCanceledStatus(readStatus(row)) &&
    !isCompletedStatus(readStatus(row))
  )
}

function isTodayBooking(row: Record<string, unknown>) {
  const time = readTime(readBookingDate(row))
  return time >= startOfToday() && time < startOfTomorrow()
}

function isNoShowCandidate(row: Record<string, unknown>) {
  const status = readStatus(row)

  return (
    readTime(readBookingDate(row)) > 0 &&
    readTime(readBookingDate(row)) < Date.now() &&
    !isCanceledStatus(status) &&
    !isCompletedStatus(status)
  )
}

function readBookingDate(row: Record<string, unknown>) {
  return row.selectedDate ?? row.appointmentDate ?? row.createdAt
}

function readStatus(row: Record<string, unknown>) {
  return readString(row.status) || 'Unconfirmed'
}

function readString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return typeof value === 'string' ? value.trim() : ''
}

function hasLocation(row: Record<string, unknown>) {
  return Boolean(
    readString(row.location) ||
      readString(row.place) ||
      (typeof row.latitude === 'number' && typeof row.longitude === 'number') ||
      row.coordinate,
  )
}

function hasMedia(value: unknown) {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return Boolean(value)
}

function hasItems(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).length > 0
  }

  return false
}

function isPendingStatus(status: string) {
  return /unconfirmed|rescheduled/i.test(status)
}

function isCanceledStatus(status: string) {
  return /canceled|cancelled/i.test(status)
}

function isCompletedStatus(status: string) {
  return /completed/i.test(status)
}

function defaultAppointmentSlots() {
  const slots: string[] = []

  for (let hour = 8; hour < 17; hour += 1) {
    if (hour === 13) {
      continue
    }
    slots.push(`${hour.toString().padStart(2, '0')}:30`)
  }

  return slots
}

function buildSelectedDate(dateValue: string, time: string) {
  const [year, month, day] = dateValue.split('-').map(value => Number(value))
  const [hour, minute] = time.split(':').map(value => Number(value))
  const date = new Date(year, month - 1, day, hour, minute, 0, 0)
  return date.getTime()
}

function formatAppointmentDate(value: string) {
  const [year, month, day] = value.split('-').map(part => Number(part))

  if (!year || !month || !day) {
    return ''
  }

  const date = new Date(year, month - 1, day)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return formatDateForMobile(date)
}

function formatDateForMobile(date: Date) {
  return [
    date.getDate().toString().padStart(2, '0'),
    (date.getMonth() + 1).toString().padStart(2, '0'),
    date.getFullYear(),
  ].join('/')
}

function buildProfessionalName(row: Record<string, unknown>) {
  return [readString(row.firstName), readString(row.lastName)].filter(Boolean).join(' ') ||
    readString(row.username) ||
    readString(row.email) ||
    'Professional'
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function startOfTomorrow() {
  return startOfToday() + 24 * 60 * 60 * 1000
}

function readTime(value: unknown) {
  const date = parseDate(value)
  return date?.getTime() ?? 0
}

function serializeDate(value: unknown) {
  return parseDate(value)?.toISOString()
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

  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}
