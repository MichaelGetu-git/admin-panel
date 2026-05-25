import 'server-only'

import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { getDocumentRef } from './firestore-crud-utils'
import { HttpError } from './http'

const sampleLimit = 500
const taxiMobileApps = new Set(['taxiRider', 'taxiDriver'])
const terminalTripStatuses = new Set([
  'no_driver_found',
  'passenger_cancelled',
  'trip_completed',
])

export interface TaxiDriverSummary {
  car: string
  carType: string
  email: string
  hasLocation: boolean
  id: string
  isDispatchReady: boolean
  isActive: boolean
  isBusy: boolean
  issues: string[]
  name: string
  phone: string
  rating: number
}

export interface TaxiTripSummary {
  createdAt?: string
  driver: string
  durationMinutes: number
  id: string
  paymentMethod: string
  passenger: string
  price: number
  rejectedDrivers: number
  route: string
  status: string
  type: string
}

export interface TaxiCarCategorySummary {
  id: string
  issues: string[]
  name: string
  pricing: string
  type: string
}

export interface TaxiLaunchIssue {
  detail: string
  label: string
  severity: 'high' | 'low' | 'medium'
}

export interface TaxiPayoutSummary {
  completedTrips: number
  driver: string
  driverId: string
  grossRevenue: number
}

export interface TaxiOperationsOverview {
  carCategories: {
    readinessIssues: TaxiCarCategorySummary[]
    recent: TaxiCarCategorySummary[]
    missingPricing: number
    missingVisuals: number
    total: number
  }
  dispatch: {
    awaitingDriver: number
    driverRejected: number
    incidents: TaxiTripSummary[]
    noDriverFound: number
    rejectedDriverAttempts: number
    staleActiveTrips: number
  }
  drivers: {
    available: number
    busy: number
    offline: number
    online: number
    readinessIssues: TaxiDriverSummary[]
    recent: TaxiDriverSummary[]
    total: number
    withoutCarPhoto: number
    withoutCarType: number
    withoutLocation: number
    withoutPhone: number
    withoutProfilePhoto: number
  }
  entities: {
    carCategories?: string
    paymentMethods?: string
    trips?: string
    users?: string
  }
  isEnabled: boolean
  launchReadiness: {
    issues: TaxiLaunchIssue[]
    score: number
  }
  lifecycle: {
    activeTimeline: TaxiTripSummary[]
    averageCompletedMinutes: number
    completedWithoutPrice: number
    longRunningActive: number
    recentCompleted: TaxiTripSummary[]
  }
  payments: {
    cardMethods: number
    cashTrips: number
    customersWithoutDefaultPayment: number
    methodsTotal: number
    pendingCashCollection: number
  }
  payouts: {
    completedTrips: number
    driversWithCompletedTrips: number
    grossRevenue: number
    recent: TaxiPayoutSummary[]
  }
  statusOptions: string[]
  trips: {
    active: number
    awaitingDriver: number
    canceled: number
    completed: number
    noDriverFound: number
    recent: TaxiTripSummary[]
    revenue: number
    statusCounts: Array<{ count: number; status: string }>
    total: number
  }
}

export async function getTaxiOperationsOverview(): Promise<TaxiOperationsOverview> {
  const entities = getTaxiEntities()

  if (!isTaxiOperationsPanel(entities)) {
    return emptyOverview(false, entities)
  }

  const [
    tripRows,
    userRows,
    carCategoryRows,
    paymentMethodRows,
    tripCount,
    carCategoryCount,
  ] = await Promise.all([
    entities.trips ? listEntityRows(entities.trips) : Promise.resolve([]),
    entities.users ? listEntityRows(entities.users) : Promise.resolve([]),
    entities.carCategories ? listEntityRows(entities.carCategories) : Promise.resolve([]),
    entities.paymentMethods ? listEntityRows(entities.paymentMethods) : Promise.resolve([]),
    countEntityDocs(entities.trips),
    countEntityDocs(entities.carCategories),
  ])
  const driverRows = userRows.filter(row => readString(row.role) === 'driver')
  const driverSummaries = driverRows.map(buildDriverSummary)
  const carCategorySummaries = carCategoryRows.map(buildCarCategorySummary)
  const recentTrips = tripRows
    .slice()
    .sort((left, right) => readTime(right.createdAt) - readTime(left.createdAt))
    .slice(0, 12)
    .map(buildTripSummary)
  const dispatch = buildDispatchSummary(tripRows)
  const lifecycle = buildLifecycleSummary(tripRows)
  const payments = buildPaymentSummary(tripRows, userRows, paymentMethodRows)
  const payouts = buildPayoutSummary(tripRows)
  const launchIssues = buildLaunchIssues({
    carCategories: carCategorySummaries,
    dispatch,
    drivers: driverSummaries,
    payments,
  })

  return {
    carCategories: {
      readinessIssues: carCategorySummaries
        .filter(category => category.issues.length > 0)
        .slice(0, 12),
      recent: carCategorySummaries.slice(0, 10),
      missingPricing: carCategorySummaries.filter(category =>
        category.issues.some(issue => /fare|pricing|speed|passenger/i.test(issue)),
      ).length,
      missingVisuals: carCategoryRows.filter(row => !hasMedia(row.photo ?? row.marker)).length,
      total: carCategoryCount,
    },
    dispatch,
    drivers: {
      available: driverSummaries.filter(driver => driver.isActive && !driver.isBusy).length,
      busy: driverSummaries.filter(driver => driver.isBusy).length,
      offline: driverSummaries.filter(driver => !driver.isActive).length,
      online: driverSummaries.filter(driver => driver.isActive).length,
      readinessIssues: driverSummaries.filter(driver => driver.issues.length > 0).slice(0, 12),
      recent: driverSummaries.slice(0, 10),
      total: driverSummaries.length,
      withoutCarPhoto: driverSummaries.filter(driver =>
        driver.issues.includes('Missing car photo'),
      ).length,
      withoutCarType: driverSummaries.filter(driver =>
        driver.issues.includes('Missing car type'),
      ).length,
      withoutLocation: driverSummaries.filter(driver => !driver.hasLocation).length,
      withoutPhone: driverSummaries.filter(driver => !driver.phone).length,
      withoutProfilePhoto: driverSummaries.filter(driver =>
        driver.issues.includes('Missing profile photo'),
      ).length,
    },
    entities: serializeTaxiEntities(entities),
    isEnabled: true,
    launchReadiness: {
      issues: launchIssues,
      score: scoreLaunchReadiness(launchIssues),
    },
    lifecycle,
    payments,
    payouts,
    statusOptions: getStatusOptions(entities.trips),
    trips: {
      active: tripRows.filter(row => isActiveTrip(readStatus(row))).length,
      awaitingDriver: tripRows.filter(row => readStatus(row) === 'awaiting_driver').length,
      canceled: tripRows.filter(row => readStatus(row) === 'passenger_cancelled').length,
      completed: tripRows.filter(row => readStatus(row) === 'trip_completed').length,
      noDriverFound: tripRows.filter(row => readStatus(row) === 'no_driver_found').length,
      recent: recentTrips,
      revenue: roundCurrency(
        tripRows
          .filter(row => readStatus(row) === 'trip_completed')
          .reduce((sum, row) => sum + readNumber(row.price), 0),
      ),
      statusCounts: countByStatus(tripRows),
      total: tripCount,
    },
  }
}

export async function updateTaxiTripStatus(
  id: string,
  status: string,
  actor: AdminSessionUser,
) {
  const entities = getTaxiEntities()

  if (!entities.trips || !isTaxiOperationsPanel(entities)) {
    throw new HttpError('Taxi Operations is not enabled for this panel.', 404)
  }

  const statusOptions = getStatusOptions(entities.trips)

  if (!statusOptions.includes(status)) {
    throw new HttpError('Unsupported taxi trip status.', 400)
  }

  const ref = getDocumentRef(entities.trips, id)
  const snapshot = await ref.get()

  if (!snapshot.exists) {
    throw new HttpError('Taxi trip was not found.', 404)
  }

  const trip = snapshot.data() ?? {}
  const patch: Record<string, unknown> = {
    adminUpdatedAt: Date.now(),
    adminUpdatedBy: actor.uid,
    status,
    updatedAt: Date.now(),
  }

  if (status === 'trip_started' && !trip.tripStartTime) {
    patch.tripStartTime = Date.now()
  }

  if (status === 'trip_completed' && !trip.tripEndTime) {
    patch.tripEndTime = Date.now()
  }

  await ref.set(patch, { merge: true })

  if (terminalTripStatuses.has(status)) {
    await clearInProgressTripUsers(trip, entities.users)
  }

  await writeAuditLog({
    action: 'taxi.trip_status_update',
    actor,
    metadata: { status },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entities.trips.key,
  })

  return { id, status, success: true }
}

export async function clearTaxiTripStuckState(id: string, actor: AdminSessionUser) {
  const entities = getTaxiEntities()

  if (!entities.trips || !isTaxiOperationsPanel(entities)) {
    throw new HttpError('Taxi Operations is not enabled for this panel.', 404)
  }

  const ref = getDocumentRef(entities.trips, id)
  const snapshot = await ref.get()

  if (!snapshot.exists) {
    throw new HttpError('Taxi trip was not found.', 404)
  }

  const now = Date.now()
  const trip = snapshot.data() ?? {}
  const clearedUsers = await clearInProgressTripUsers(trip, entities.users)

  await ref.set(
    {
      adminClearedStuckStateAt: now,
      adminClearedStuckStateBy: actor.uid,
      adminUpdatedAt: now,
      adminUpdatedBy: actor.uid,
      updatedAt: now,
    },
    { merge: true },
  )

  await writeAuditLog({
    action: 'taxi.clear_stuck_state',
    actor,
    metadata: { clearedUsers },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entities.trips.key,
  })

  return { clearedUsers, id, success: true }
}

export async function assignTaxiTripDriver(
  tripId: string,
  driverId: string,
  actor: AdminSessionUser,
) {
  const entities = getTaxiEntities()

  if (!entities.trips || !entities.users || !isTaxiOperationsPanel(entities)) {
    throw new HttpError('Taxi Operations is not enabled for this panel.', 404)
  }

  const tripRef = getDocumentRef(entities.trips, tripId)
  const driverRef = getDocumentRef(entities.users, driverId)
  const [tripSnapshot, driverSnapshot] = await Promise.all([
    tripRef.get(),
    driverRef.get(),
  ])

  if (!tripSnapshot.exists) {
    throw new HttpError('Taxi trip was not found.', 404)
  }

  if (!driverSnapshot.exists) {
    throw new HttpError('Driver was not found.', 404)
  }

  const trip = { id: tripSnapshot.id, ...tripSnapshot.data() } as Record<string, unknown>
  const driver = { id: driverSnapshot.id, ...driverSnapshot.data() } as Record<string, unknown>
  const status = readStatus(trip)
  const assignableStatuses = new Set(['awaiting_driver', 'driver_rejected', 'no_driver_found'])

  if (!assignableStatuses.has(status)) {
    throw new HttpError('This trip status does not support driver assignment.', 400)
  }

  if (readString(driver.role) !== 'driver') {
    throw new HttpError('Selected user is not a taxi driver.', 400)
  }

  if (driver.isActive !== true) {
    throw new HttpError('Selected driver is offline.', 400)
  }

  if (readString(trip.carType) && readString(driver.carType) !== readString(trip.carType)) {
    throw new HttpError('Selected driver does not match the requested car type.', 400)
  }

  if (!driver.location) {
    throw new HttpError('Selected driver has no live location.', 400)
  }

  if (readString(driver.inProgressOrderID) || driver.orderRequestData) {
    throw new HttpError('Selected driver is already assigned to another trip.', 409)
  }

  const rejectedByDrivers = Array.isArray(trip.rejectedByDrivers)
    ? trip.rejectedByDrivers.map(readString).filter(Boolean)
    : []

  if (rejectedByDrivers.includes(driverId)) {
    throw new HttpError('Selected driver already rejected this trip.', 409)
  }

  const now = Date.now()
  const driverSnapshotData = {
    carName: readString(driver.carName),
    carNumber: readString(driver.carNumber),
    carPictureURL: readString(driver.carPictureURL),
    carType: readString(driver.carType),
    email: readString(driver.email),
    firstName: readString(driver.firstName),
    id: driverId,
    lastName: readString(driver.lastName),
    location: driver.location,
    phone: readString(driver.phone),
    profilePictureURL: readString(driver.profilePictureURL),
  }

  await Promise.all([
    tripRef.set(
      {
        adminAssignedAt: now,
        adminAssignedBy: actor.uid,
        adminUpdatedAt: now,
        adminUpdatedBy: actor.uid,
        carDrive: driver.location,
        driver: driverSnapshotData,
        driverID: driverId,
        status: 'driver_accepted',
        updatedAt: now,
      },
      { merge: true },
    ),
    driverRef.set(
      {
        inProgressOrderID: tripId,
        orderRequestData: null,
        updatedAt: now,
      },
      { merge: true },
    ),
  ])

  await writeAuditLog({
    action: 'taxi.trip_driver_assign',
    actor,
    metadata: { driverId, previousStatus: status },
    resourceId: tripId,
    resourcePath: tripRef.path,
    resourceType: entities.trips.key,
  })

  return { driverId, id: tripId, status: 'driver_accepted', success: true }
}

export async function updateTaxiDriverAvailability(
  id: string,
  isActive: boolean,
  actor: AdminSessionUser,
) {
  const entities = getTaxiEntities()

  if (!entities.users || !isTaxiOperationsPanel(entities)) {
    throw new HttpError('Taxi Operations is not enabled for this panel.', 404)
  }

  const ref = getDocumentRef(entities.users, id)
  const snapshot = await ref.get()
  const user = snapshot.data()

  if (user?.role !== 'driver') {
    throw new HttpError('Only taxi drivers can be updated from Taxi Operations.', 400)
  }

  await ref.set(
    {
      adminUpdatedAt: Date.now(),
      adminUpdatedBy: actor.uid,
      isActive,
      updatedAt: Date.now(),
    },
    { merge: true },
  )
  await writeAuditLog({
    action: 'taxi.driver_availability_update',
    actor,
    metadata: { isActive },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entities.users.key,
  })

  return { id, isActive, success: true }
}

function getTaxiEntities() {
  return {
    carCategories: findEntity(['carCategories', 'car-categories']),
    paymentMethods: findEntity(['paymentMethods', 'payment-methods']),
    trips: findEntity(['trips']),
    users: findEntity(['users']),
  }
}

function isTaxiOperationsPanel(entities: ReturnType<typeof getTaxiEntities>) {
  return (
    taxiMobileApps.has(adminPanelConfig.mobileApp) ||
    Boolean(entities.trips && entities.carCategories)
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

async function clearInProgressTripUsers(
  trip: FirebaseFirestore.DocumentData,
  usersEntity: AdminEntityConfig | undefined,
) {
  if (!usersEntity) {
    return 0
  }

  const db = getFirebaseAdminFirestore()
  const userIds = new Set(
    [
      readString(trip.passengerID),
      readNestedString(trip.passenger, 'id'),
      readString(trip.driverID),
      readNestedString(trip.driver, 'id'),
    ].filter(Boolean),
  )

  await Promise.all(
    [...userIds].map(userId =>
      db.collection(usersEntity.collection).doc(userId).set(
        {
          inProgressOrderID: null,
          orderRequestData: null,
          updatedAt: Date.now(),
        },
        { merge: true },
      ),
    ),
  )

  return userIds.size
}

function buildDriverSummary(row: Record<string, unknown>): TaxiDriverSummary {
  const isBusy = Boolean(readString(row.inProgressOrderID) || row.orderRequestData)
  const carType = readString(row.carType)
  const hasLocation = Boolean(row.location)
  const issues: string[] = []

  if (!readString(row.phone)) {
    issues.push('Missing phone number')
  }

  if (!hasMedia(row.profilePictureURL)) {
    issues.push('Missing profile photo')
  }

  if (!readString(row.carName)) {
    issues.push('Missing car name')
  }

  if (!readString(row.carNumber)) {
    issues.push('Missing car number')
  }

  if (!carType || carType === 'none') {
    issues.push('Missing car type')
  }

  if (!hasLocation) {
    issues.push('Missing live location')
  }

  if (!hasMedia(row.carPictureURL ?? row.carAvatar)) {
    issues.push('Missing car photo')
  }

  return {
    car: [readString(row.carName), readString(row.carNumber)].filter(Boolean).join(' ') || 'No car',
    carType,
    email: readString(row.email),
    hasLocation,
    id: readString(row.id),
    isDispatchReady: row.isActive === true && !isBusy && hasLocation && Boolean(carType),
    isActive: row.isActive === true,
    isBusy,
    issues,
    name: [readString(row.firstName), readString(row.lastName)].filter(Boolean).join(' ') ||
      readString(row.email) ||
      'Driver',
    phone: readString(row.phone),
    rating: readNumber(row.ratings),
  }
}

function buildTripSummary(row: Record<string, unknown>): TaxiTripSummary {
  const tripStart = readTime(row.tripStartTime)
  const tripEnd = readTime(row.tripEndTime)
  const created = readTime(row.createdAt)
  const durationMinutes = tripStart && tripEnd
    ? Math.max(0, Math.round((tripEnd - tripStart) / 60000))
    : created
      ? Math.max(0, Math.round((Date.now() - created) / 60000))
      : 0

  return {
    createdAt: serializeDate(row.createdAt),
    driver: readNestedName(row.driver) || readString(row.driverID) || 'Unassigned',
    durationMinutes,
    id: readString(row.id),
    paymentMethod:
      readNestedString(row.passenger, 'defaultPaymentKey') ||
      readNestedString(row.paymentMethod, 'key') ||
      'unknown',
    passenger: readNestedName(row.passenger) || readString(row.passengerID) || 'Passenger',
    price: readNumber(row.price),
    rejectedDrivers: Array.isArray(row.rejectedByDrivers) ? row.rejectedByDrivers.length : 0,
    route: formatRoute(row.pickup, row.dropoff),
    status: readStatus(row),
    type: readString(row.carType) || readNestedString(row.ride, 'name') || 'Taxi',
  }
}

function buildCarCategorySummary(row: Record<string, unknown>): TaxiCarCategorySummary {
  const issues: string[] = []
  const baseFare = readNumber(row.baseFare)
  const minimumFare = readNumber(row.minimumFare)
  const costPerKm = readNumber(row.costPerKm)
  const costPerMin = readNumber(row.costPerMin)
  const speed = readNumber(row.averageSpeedPerMin)
  const passengers = readNumber(row.numberOfPassenger)

  if (!readString(row.type)) {
    issues.push('Missing category type')
  }

  if (!readString(row.name)) {
    issues.push('Missing category name')
  }

  if (baseFare <= 0) {
    issues.push('Missing base fare')
  }

  if (minimumFare <= 0) {
    issues.push('Missing minimum fare')
  }

  if (costPerKm <= 0) {
    issues.push('Missing cost per km')
  }

  if (costPerMin <= 0) {
    issues.push('Missing cost per minute')
  }

  if (speed <= 0) {
    issues.push('Missing average speed')
  }

  if (passengers <= 0) {
    issues.push('Missing passenger capacity')
  }

  if (!hasMedia(row.photo ?? row.marker)) {
    issues.push('Missing rider visual')
  }

  return {
    id: readString(row.id) || readString(row.type),
    issues,
    name: readString(row.name) || 'Car category',
    pricing: `${formatCurrency(baseFare)} base / ${formatCurrency(costPerKm)} km / ${formatCurrency(costPerMin)} min`,
    type: readString(row.type),
  }
}

function buildDispatchSummary(rows: Array<Record<string, unknown>>) {
  const incidents = rows
    .filter(row => isDispatchIncident(row))
    .sort((left, right) => readTime(right.createdAt) - readTime(left.createdAt))
    .slice(0, 10)
    .map(buildTripSummary)

  return {
    awaitingDriver: rows.filter(row => readStatus(row) === 'awaiting_driver').length,
    driverRejected: rows.filter(row => readStatus(row) === 'driver_rejected').length,
    incidents,
    noDriverFound: rows.filter(row => readStatus(row) === 'no_driver_found').length,
    rejectedDriverAttempts: rows.reduce((sum, row) => {
      return sum + (Array.isArray(row.rejectedByDrivers) ? row.rejectedByDrivers.length : 0)
    }, 0),
    staleActiveTrips: rows.filter(isStaleActiveTrip).length,
  }
}

function buildLifecycleSummary(rows: Array<Record<string, unknown>>) {
  const completedRows = rows.filter(row => readStatus(row) === 'trip_completed')
  const completedDurations = completedRows
    .map(row => {
      const start = readTime(row.tripStartTime)
      const end = readTime(row.tripEndTime)
      return start && end && end >= start ? Math.round((end - start) / 60000) : 0
    })
    .filter(duration => duration > 0)

  return {
    activeTimeline: rows
      .filter(row => isActiveTrip(readStatus(row)))
      .sort((left, right) => readTime(right.createdAt) - readTime(left.createdAt))
      .slice(0, 10)
      .map(buildTripSummary),
    averageCompletedMinutes: completedDurations.length > 0
      ? Math.round(completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length)
      : 0,
    completedWithoutPrice: completedRows.filter(row => readNumber(row.price) <= 0).length,
    longRunningActive: rows.filter(row => {
      if (!isActiveTrip(readStatus(row))) {
        return false
      }

      const start = readTime(row.tripStartTime) || readTime(row.createdAt)
      return start > 0 && Date.now() - start > 90 * 60 * 1000
    }).length,
    recentCompleted: completedRows
      .sort((left, right) => readTime(right.tripEndTime ?? right.updatedAt ?? right.createdAt) - readTime(left.tripEndTime ?? left.updatedAt ?? left.createdAt))
      .slice(0, 8)
      .map(buildTripSummary),
  }
}

function buildPaymentSummary(
  tripRows: Array<Record<string, unknown>>,
  userRows: Array<Record<string, unknown>>,
  paymentMethodRows: Array<Record<string, unknown>>,
) {
  const customerRows = userRows.filter(row => readString(row.role) !== 'driver')
  const completedRows = tripRows.filter(row => readStatus(row) === 'trip_completed')
  const cashTripRows = completedRows.filter(row => {
    return readNestedString(row.passenger, 'defaultPaymentKey') === 'cash' ||
      readString(row.defaultPaymentKey) === 'cash'
  })

  return {
    cardMethods: paymentMethodRows.filter(row => readString(row.paymentMethodId)).length,
    cashTrips: cashTripRows.length,
    customersWithoutDefaultPayment: customerRows.filter(row => !readString(row.defaultPaymentKey)).length,
    methodsTotal: paymentMethodRows.length,
    pendingCashCollection: roundCurrency(
      cashTripRows.reduce((sum, row) => sum + readNumber(row.price), 0),
    ),
  }
}

function buildPayoutSummary(rows: Array<Record<string, unknown>>) {
  const completedRows = rows.filter(row => readStatus(row) === 'trip_completed')
  const byDriver = new Map<string, TaxiPayoutSummary>()

  completedRows.forEach(row => {
    const driverId = readString(row.driverID) || readNestedString(row.driver, 'id') || 'unassigned'
    const current = byDriver.get(driverId) ?? {
      completedTrips: 0,
      driver: readNestedName(row.driver) || driverId,
      driverId,
      grossRevenue: 0,
    }

    current.completedTrips += 1
    current.grossRevenue = roundCurrency(current.grossRevenue + readNumber(row.price))
    byDriver.set(driverId, current)
  })

  const recent = [...byDriver.values()].sort((left, right) => right.grossRevenue - left.grossRevenue)

  return {
    completedTrips: completedRows.length,
    driversWithCompletedTrips: recent.filter(item => item.driverId !== 'unassigned').length,
    grossRevenue: roundCurrency(completedRows.reduce((sum, row) => sum + readNumber(row.price), 0)),
    recent: recent.slice(0, 8),
  }
}

function buildLaunchIssues({
  carCategories,
  dispatch,
  drivers,
  payments,
}: {
  carCategories: TaxiCarCategorySummary[]
  dispatch: ReturnType<typeof buildDispatchSummary>
  drivers: TaxiDriverSummary[]
  payments: ReturnType<typeof buildPaymentSummary>
}): TaxiLaunchIssue[] {
  const issues: TaxiLaunchIssue[] = []
  const driverIssues = drivers.filter(driver => driver.issues.length > 0)
  const onlineDrivers = drivers.filter(driver => driver.isActive)
  const availableDrivers = drivers.filter(driver => driver.isActive && !driver.isBusy && driver.hasLocation)
  const categoryIssues = carCategories.filter(category => category.issues.length > 0)

  if (carCategories.length === 0) {
    issues.push({
      detail: 'Rider app cannot quote rides without taxi_car_categories.',
      label: 'No car categories',
      severity: 'high',
    })
  }

  if (drivers.length === 0) {
    issues.push({
      detail: 'Dispatch searches users with role "driver". Add at least one driver account.',
      label: 'No drivers',
      severity: 'high',
    })
  } else if (onlineDrivers.length === 0) {
    issues.push({
      detail: 'Firebase dispatch only picks drivers with isActive = true.',
      label: 'No online drivers',
      severity: 'high',
    })
  } else if (availableDrivers.length === 0) {
    issues.push({
      detail: 'Online drivers must also have location and no in-progress trip.',
      label: 'No dispatch-ready drivers',
      severity: 'medium',
    })
  }

  if (categoryIssues.length > 0) {
    issues.push({
      detail: `${categoryIssues.length} car categories are missing pricing, capacity or visuals.`,
      label: 'Pricing setup gaps',
      severity: 'medium',
    })
  }

  if (driverIssues.length > 0) {
    issues.push({
      detail: `${driverIssues.length} drivers need profile, phone, car, location or photo cleanup.`,
      label: 'Driver onboarding gaps',
      severity: 'medium',
    })
  }

  if (dispatch.noDriverFound > 0 || dispatch.staleActiveTrips > 0) {
    issues.push({
      detail: `${dispatch.noDriverFound} no-driver trips and ${dispatch.staleActiveTrips} stale active trips found in the sample.`,
      label: 'Dispatch incidents',
      severity: 'medium',
    })
  }

  if (payments.methodsTotal === 0) {
    issues.push({
      detail: 'Cash rides can still work, but Stripe-backed saved cards are not visible in payment_methods.',
      label: 'No saved payment methods',
      severity: 'low',
    })
  }

  return issues
}

function scoreLaunchReadiness(issues: TaxiLaunchIssue[]) {
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
  entities: ReturnType<typeof getTaxiEntities>,
): TaxiOperationsOverview {
  return {
    carCategories: {
      readinessIssues: [],
      recent: [],
      missingPricing: 0,
      missingVisuals: 0,
      total: 0,
    },
    dispatch: {
      awaitingDriver: 0,
      driverRejected: 0,
      incidents: [],
      noDriverFound: 0,
      rejectedDriverAttempts: 0,
      staleActiveTrips: 0,
    },
    drivers: {
      available: 0,
      busy: 0,
      offline: 0,
      online: 0,
      readinessIssues: [],
      recent: [],
      total: 0,
      withoutCarPhoto: 0,
      withoutCarType: 0,
      withoutLocation: 0,
      withoutPhone: 0,
      withoutProfilePhoto: 0,
    },
    entities: serializeTaxiEntities(entities),
    isEnabled,
    launchReadiness: {
      issues: [],
      score: 0,
    },
    lifecycle: {
      activeTimeline: [],
      averageCompletedMinutes: 0,
      completedWithoutPrice: 0,
      longRunningActive: 0,
      recentCompleted: [],
    },
    payments: {
      cardMethods: 0,
      cashTrips: 0,
      customersWithoutDefaultPayment: 0,
      methodsTotal: 0,
      pendingCashCollection: 0,
    },
    payouts: {
      completedTrips: 0,
      driversWithCompletedTrips: 0,
      grossRevenue: 0,
      recent: [],
    },
    statusOptions: [],
    trips: {
      active: 0,
      awaitingDriver: 0,
      canceled: 0,
      completed: 0,
      noDriverFound: 0,
      recent: [],
      revenue: 0,
      statusCounts: [],
      total: 0,
    },
  }
}

function serializeTaxiEntities(entities: ReturnType<typeof getTaxiEntities>) {
  return {
    carCategories: entities.carCategories?.route,
    paymentMethods: entities.paymentMethods?.route,
    trips: entities.trips?.route,
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

  return [
    'awaiting_driver',
    'driver_accepted',
    'driver_rejected',
    'passenger_cancelled',
    'trip_started',
    'trip_completed',
    'no_driver_found',
  ]
}

function readStatus(row: Record<string, unknown>) {
  return readString(row.status) || 'awaiting_driver'
}

function isActiveTrip(status: string) {
  return ['awaiting_driver', 'driver_accepted', 'driver_rejected', 'trip_started'].includes(status)
}

function isDispatchIncident(row: Record<string, unknown>) {
  const status = readStatus(row)

  return (
    status === 'no_driver_found' ||
    status === 'driver_rejected' ||
    status === 'passenger_cancelled' ||
    isStaleActiveTrip(row) ||
    (status === 'trip_completed' && readNumber(row.price) <= 0)
  )
}

function isStaleActiveTrip(row: Record<string, unknown>) {
  if (!isActiveTrip(readStatus(row))) {
    return false
  }

  const time = readTime(row.tripStartTime) || readTime(row.createdAt)
  return time > 0 && Date.now() - time > 30 * 60 * 1000
}

function formatRoute(pickup: unknown, dropoff: unknown) {
  const pickupTitle = readNestedString(pickup, 'title') || readNestedString(pickup, 'name') || 'Pickup'
  const dropoffTitle = readNestedString(dropoff, 'title') || readNestedString(dropoff, 'name') || 'Dropoff'
  return `${pickupTitle} -> ${dropoffTitle}`
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

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0'
  }

  return String(Math.round(value * 100) / 100)
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

  if (typeof value === 'string') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      const date = new Date(parsed < 100000000000 ? parsed * 1000 : parsed)
      return Number.isNaN(date.getTime()) ? null : date
    }
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    return date && !Number.isNaN(date.getTime()) ? date : null
  }

  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}
