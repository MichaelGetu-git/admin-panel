import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { getDocumentRef } from './firestore-crud-utils'
import { HttpError } from './http'

const sampleLimit = 500
const commerceMobileApps = new Set([
  'shopertinoFirebase',
  'multiVendorAllInOne',
  'singleVendorConsumer',
])

export interface CommerceOverview {
  catalog: {
    categories: number
    inventory: {
      issues: CommerceReadinessIssue[]
      lowStock: number
      missingSku: number
      outOfStock: number
      tracked: number
    }
    missingPhoto: number
    missingPrice: number
    productIssues: CommerceReadinessIssue[]
    products: number
    vendorIssues: CommerceReadinessIssue[]
    vendors: number
  }
  drivers: {
    available: number
    busy: number
    offline: number
    online: number
    readinessIssues: CommerceReadinessIssue[]
    recent: CommerceDriverSummary[]
    total: number
  }
  entities: {
    categories?: string
    deliveries?: string
    orders: string
    products: string
    reservations?: string
    users?: string
    vendors?: string
  }
  fulfillment: {
    accepted: number
    completed: number
    driverAccepted: number
    driverPending: number
    inTransit: number
    needsDriverAction: number
    needsVendorAction: number
    placed: number
    problem: number
    shipped: number
  }
  isEnabled: boolean
  launchReadiness: {
    issues: string[]
    score: number
  }
  operations: {
    activeDeliveries: number
    deliveryStatuses: Array<{ count: number; status: string }>
    openReservations: number
  }
  orders: {
    averageOrderValue: number
    cancelled: number
    delivered: number
    pending: number
    recent: CommerceOrderSummary[]
    revenue: number
    statusCounts: Array<{ count: number; status: string }>
    total: number
  }
  payments: {
    paid: number
    statuses: Array<{ count: number; status: string }>
    unknown: number
    unpaid: number
  }
  payouts: {
    driverGross: number
    drivers: CommercePayoutSummary[]
    driversWithRevenue: number
    pendingOrders: number
    vendorGross: number
    vendors: CommercePayoutSummary[]
    vendorsWithRevenue: number
  }
  promotions: {
    activeSaleProducts: number
    couponOrders: number
    discountTotal: number
    featuredProducts: number
    topCoupons: Array<{ code: string; count: number }>
  }
  refunds: {
    completed: number
    eligible: CommerceOrderSummary[]
    pending: number
    requested: number
  }
  statusOptions: string[]
}

export interface CommerceDriverSummary {
  currentOrderId: string
  email: string
  id: string
  isActive: boolean
  isBusy: boolean
  issues: string[]
  name: string
}

export interface CommerceOrderSummary {
  createdAt?: string
  customer: string
  driver: string
  id: string
  paymentStatus: string
  refundStatus: string
  status: string
  total: number
  vendor: string
}

export interface CommerceReadinessIssue {
  href?: string
  id: string
  issues: string[]
  label: string
}

export interface CommercePayoutSummary {
  grossRevenue: number
  id: string
  label: string
  orders: number
}

export async function getCommerceOverview(): Promise<CommerceOverview> {
  const entities = getCommerceEntities()

  if (!entities.orders || !entities.products) {
    return emptyOverview(false, entities)
  }

  const [
    orderDocs,
    productDocs,
    categoryCount,
    vendorDocs,
    deliveryDocs,
    reservationDocs,
    userDocs,
  ] = await Promise.all([
    listEntityDocs(entities.orders),
    listEntityDocs(entities.products),
    countEntityDocs(entities.categories),
    entities.vendors ? listEntityDocs(entities.vendors) : Promise.resolve([]),
    entities.deliveries ? listEntityDocs(entities.deliveries, 250) : Promise.resolve([]),
    entities.reservations ? listEntityDocs(entities.reservations, 250) : Promise.resolve([]),
    entities.users ? listEntityDocs(entities.users) : Promise.resolve([]),
  ])
  const orderRows = orderDocs.map(doc => serializeRow(doc))
  const productRows = productDocs.map(doc => serializeRow(doc))
  const vendorRows = vendorDocs.map(doc => serializeRow(doc))
  const deliveryRows = deliveryDocs.map(doc => serializeRow(doc))
  const reservationRows = reservationDocs.map(doc => serializeRow(doc))
  const userRows = userDocs.map(doc => serializeRow(doc))
  const statusCounts = countByStatus(orderRows)
  const deliveryStatuses = countByStatus(deliveryRows)
  const paymentStatuses = countByPaymentStatus(orderRows)
  const totalRevenue = orderRows.reduce((sum, order) => sum + readOrderTotal(order), 0)
  const delivered = orderRows.filter(order => isDeliveredStatus(readStatus(order))).length
  const cancelled = orderRows.filter(order => isCancelledStatus(readStatus(order))).length
  const pending = orderRows.filter(order => isPendingStatus(readStatus(order))).length
  const productIssues = productRows
    .map(product => buildProductIssue(product, entities))
    .filter((issue): issue is CommerceReadinessIssue => Boolean(issue))
    .slice(0, 8)
  const inventoryIssues = productRows
    .map(product => buildInventoryIssue(product, entities))
    .filter((issue): issue is CommerceReadinessIssue => Boolean(issue))
    .slice(0, 8)
  const stockRows = productRows
    .map(product => readProductStock(product))
    .filter((stock): stock is number => stock !== null)
  const hasSkuTracking = productRows.some(product => hasProductSkuField(product))
  const vendorIssues = vendorRows
    .map(vendor => buildVendorIssue(vendor, entities))
    .filter((issue): issue is CommerceReadinessIssue => Boolean(issue))
    .slice(0, 8)
  const driverSummaries = userRows
    .filter(user => readString(user.role).toLowerCase() === 'driver')
    .map(buildDriverSummary)
  const launchIssues = buildLaunchIssues({
    categoryCount,
    driverSummaries,
    entities,
    productIssues,
    productRows,
    vendorIssues,
    vendorRows,
  })
  const recent = orderRows
    .slice()
    .sort((left, right) => readTime(right.createdAt) - readTime(left.createdAt))
    .slice(0, 10)
    .map(order => ({
      createdAt: serializeDate(order.createdAt),
      customer: readCustomerLabel(order),
      driver: readDriverLabel(order),
      id: readString(order.id),
      paymentStatus: readPaymentStatus(order),
      refundStatus: readRefundStatus(order),
      status: readStatus(order),
      total: readOrderTotal(order),
      vendor: readVendorLabel(order),
    }))
  const refundEligibleOrders = orderRows
    .filter(order => isRefundEligibleOrder(order))
    .sort((left, right) => readTime(right.createdAt) - readTime(left.createdAt))
    .slice(0, 8)
    .map(order => ({
      createdAt: serializeDate(order.createdAt),
      customer: readCustomerLabel(order),
      driver: readDriverLabel(order),
      id: readString(order.id),
      paymentStatus: readPaymentStatus(order),
      refundStatus: readRefundStatus(order),
      status: readStatus(order),
      total: readOrderTotal(order),
      vendor: readVendorLabel(order),
    }))

  return {
    catalog: {
      categories: categoryCount,
      inventory: {
        issues: inventoryIssues,
        lowStock: stockRows.filter(stock => stock > 0 && stock <= 5).length,
        missingSku: hasSkuTracking
          ? productRows.filter(product => !readProductSku(product)).length
          : 0,
        outOfStock: stockRows.filter(stock => stock <= 0).length,
        tracked: stockRows.length,
      },
      missingPhoto: productRows.filter(product => !hasMedia(product.photo ?? product.photos ?? product.details)).length,
      missingPrice: productRows.filter(product => readProductPrice(product) <= 0).length,
      productIssues,
      products: await countEntityDocs(entities.products),
      vendorIssues,
      vendors: vendorRows.length,
    },
    drivers: {
      available: driverSummaries.filter(driver => driver.isActive && !driver.isBusy).length,
      busy: driverSummaries.filter(driver => driver.isBusy).length,
      offline: driverSummaries.filter(driver => !driver.isActive).length,
      online: driverSummaries.filter(driver => driver.isActive).length,
      readinessIssues: driverSummaries
        .filter(driver => driver.issues.length > 0)
        .slice(0, 8)
        .map(driver => ({
          href: entities.users ? `/admin/${entities.users.route}/${encodeURIComponent(driver.id)}/view` : undefined,
          id: driver.id,
          issues: driver.issues,
          label: driver.name,
        })),
      recent: driverSummaries.slice(0, 10),
      total: driverSummaries.length,
    },
    entities: serializeCommerceEntities(entities),
    fulfillment: buildFulfillmentStats(orderRows),
    isEnabled: isCommercePanel(entities),
    launchReadiness: {
      issues: launchIssues,
      score: Math.max(0, 100 - launchIssues.length * 12),
    },
    operations: {
      activeDeliveries: deliveryRows.filter(delivery =>
        isPendingStatus(readStatus(delivery)),
      ).length,
      deliveryStatuses,
      openReservations: reservationRows.filter(reservation =>
        !isCancelledStatus(readStatus(reservation)) && !isDeliveredStatus(readStatus(reservation)),
      ).length,
    },
    orders: {
      averageOrderValue: orderRows.length > 0 ? roundCurrency(totalRevenue / orderRows.length) : 0,
      cancelled,
      delivered,
      pending,
      recent,
      revenue: roundCurrency(totalRevenue),
      statusCounts,
      total: await countEntityDocs(entities.orders),
    },
    payments: {
      paid: orderRows.filter(order => isPaidOrder(order)).length,
      statuses: paymentStatuses,
      unknown: orderRows.filter(order => readPaymentStatus(order) === 'Unknown').length,
      unpaid: orderRows.filter(order => isUnpaidOrder(order)).length,
    },
    payouts: buildPayoutReport(orderRows),
    promotions: buildPromotionReport(orderRows, productRows),
    refunds: {
      completed: orderRows.filter(order => readRefundStatus(order) === 'refunded').length,
      eligible: refundEligibleOrders,
      pending: orderRows.filter(order => readRefundStatus(order) === 'pending').length,
      requested: orderRows.filter(order => readRefundStatus(order) === 'requested').length,
    },
    statusOptions: getOrderStatusOptions(entities.orders),
  }
}

export async function updateCommerceOrderStatus(
  id: string,
  status: string,
  actor: AdminSessionUser,
) {
  const entities = getCommerceEntities()

  if (!entities.orders || !entities.products) {
    throw new HttpError('Commerce module is not enabled for this panel.', 404)
  }

  const statusOptions = getOrderStatusOptions(entities.orders)

  if (!statusOptions.includes(status)) {
    throw new HttpError('Unsupported order status.', 400)
  }

  const ref = getDocumentRef(entities.orders, id)
  const snapshot = await ref.get()

  if (!snapshot.exists) {
    throw new HttpError('Order not found.', 404)
  }

  const previousOrder = { id, ...snapshot.data() }
  await ref.set(
    {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  if (isTerminalDriverStatus(status)) {
    await clearCommerceDriverOrder(previousOrder, entities.users)
  }

  await writeAuditLog({
    action: 'commerce.order_status_update',
    actor,
    metadata: { status },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entities.orders.key,
  })

  return { id, status, success: true }
}

export async function updateCommerceDriverAvailability(
  id: string,
  isActive: boolean,
  actor: AdminSessionUser,
) {
  const entities = getCommerceEntities()

  if (!entities.users || !entities.orders || !entities.products) {
    throw new HttpError('Commerce driver operations are not enabled for this panel.', 404)
  }

  const ref = getDocumentRef(entities.users, id)
  const snapshot = await ref.get()
  const user = snapshot.data()

  if (!snapshot.exists) {
    throw new HttpError('Driver not found.', 404)
  }

  if (readString(user?.role).toLowerCase() !== 'driver') {
    throw new HttpError('Only delivery drivers can be updated from Commerce Operations.', 400)
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
    action: 'commerce.driver_availability_update',
    actor,
    metadata: { isActive },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entities.users.key,
  })

  return { id, isActive, success: true }
}

export async function updateCommerceOrderRefundStatus(
  id: string,
  refundStatus: string,
  actor: AdminSessionUser,
) {
  const entities = getCommerceEntities()

  if (!entities.orders || !entities.products) {
    throw new HttpError('Commerce module is not enabled for this panel.', 404)
  }

  const normalizedStatus = refundStatus.toLowerCase()
  const allowedStatuses = new Set(['none', 'requested', 'pending', 'refunded', 'rejected'])

  if (!allowedStatuses.has(normalizedStatus)) {
    throw new HttpError('Unsupported refund status.', 400)
  }

  const ref = getDocumentRef(entities.orders, id)
  const snapshot = await ref.get()

  if (!snapshot.exists) {
    throw new HttpError('Order not found.', 404)
  }

  const now = FieldValue.serverTimestamp()
  const patch: Record<string, unknown> = {
    adminRefundStatus: normalizedStatus,
    adminUpdatedBy: actor.uid,
    refundStatus: normalizedStatus,
    updatedAt: now,
  }

  if (normalizedStatus === 'refunded') {
    patch.adminRefundedAt = now
    patch.adminRefundedBy = actor.uid
  }

  await ref.set(patch, { merge: true })
  await writeAuditLog({
    action: 'commerce.refund_status_update',
    actor,
    metadata: { refundStatus: normalizedStatus },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entities.orders.key,
  })

  return { id, refundStatus: normalizedStatus, success: true }
}

function getCommerceEntities() {
  return {
    categories: findEntity(['categories']),
    deliveries: findEntity(['deliveries']),
    orders: findEntity(['orders']),
    products: findEntity(['products']),
    reservations: findEntity(['reservations']),
    users: findEntity(['users']),
    vendors: findEntity(['restaurants', 'vendors']),
  }
}

function isCommercePanel(entities = getCommerceEntities()) {
  return (
    commerceMobileApps.has(adminPanelConfig.mobileApp) ||
    Boolean(entities.orders && entities.products)
  )
}

async function listEntityDocs(entity: AdminEntityConfig, limit = sampleLimit) {
  if (entity.collectionGroups.length > 0) {
    return []
  }

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
    getFirebaseAdminFirestore().collection(entity.collection)

  if (entity.orderBy) {
    query = query.orderBy(entity.orderBy.field, entity.orderBy.direction)
  }

  return (await query.limit(limit).get()).docs
}

async function countEntityDocs(entity: AdminEntityConfig | undefined) {
  if (!entity || entity.collectionGroups.length > 0) {
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

function countByPaymentStatus(rows: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>()

  rows.forEach(row => {
    const status = readPaymentStatus(row)
    counts.set(status, (counts.get(status) ?? 0) + 1)
  })

  return [...counts.entries()]
    .map(([status, count]) => ({ count, status }))
    .sort((left, right) => right.count - left.count)
}

function serializeRow(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>,
) {
  return {
    id: doc.id,
    ...doc.data(),
  } as Record<string, unknown>
}

function emptyOverview(
  isEnabled: boolean,
  entities: ReturnType<typeof getCommerceEntities>,
): CommerceOverview {
  return {
    catalog: {
      categories: 0,
      inventory: {
        issues: [],
        lowStock: 0,
        missingSku: 0,
        outOfStock: 0,
        tracked: 0,
      },
      missingPhoto: 0,
      missingPrice: 0,
      productIssues: [],
      products: 0,
      vendorIssues: [],
      vendors: 0,
    },
    drivers: {
      available: 0,
      busy: 0,
      offline: 0,
      online: 0,
      readinessIssues: [],
      recent: [],
      total: 0,
    },
    entities: serializeCommerceEntities(entities),
    fulfillment: {
      accepted: 0,
      completed: 0,
      driverAccepted: 0,
      driverPending: 0,
      inTransit: 0,
      needsDriverAction: 0,
      needsVendorAction: 0,
      placed: 0,
      problem: 0,
      shipped: 0,
    },
    isEnabled,
    launchReadiness: {
      issues: [],
      score: 0,
    },
    operations: {
      activeDeliveries: 0,
      deliveryStatuses: [],
      openReservations: 0,
    },
    orders: {
      averageOrderValue: 0,
      cancelled: 0,
      delivered: 0,
      pending: 0,
      recent: [],
      revenue: 0,
      statusCounts: [],
      total: 0,
    },
    payments: {
      paid: 0,
      statuses: [],
      unknown: 0,
      unpaid: 0,
    },
    payouts: {
      driverGross: 0,
      drivers: [],
      driversWithRevenue: 0,
      pendingOrders: 0,
      vendorGross: 0,
      vendors: [],
      vendorsWithRevenue: 0,
    },
    promotions: {
      activeSaleProducts: 0,
      couponOrders: 0,
      discountTotal: 0,
      featuredProducts: 0,
      topCoupons: [],
    },
    refunds: {
      completed: 0,
      eligible: [],
      pending: 0,
      requested: 0,
    },
    statusOptions: [],
  }
}

function serializeCommerceEntities(entities: ReturnType<typeof getCommerceEntities>) {
  return {
    categories: entities.categories?.route,
    deliveries: entities.deliveries?.route,
    orders: entities.orders?.route ?? '',
    products: entities.products?.route ?? '',
    reservations: entities.reservations?.route,
    users: entities.users?.route,
    vendors: entities.vendors?.route,
  }
}

function findEntity(keys: string[]) {
  return adminPanelConfig.entities.find(entity => {
    return keys.includes(entity.key) || keys.includes(entity.route)
  })
}

function getOrderStatusOptions(entity: AdminEntityConfig) {
  const statusField = entity.fields.status

  if (statusField?.type === 'enum' && Array.isArray(statusField.options)) {
    return statusField.options
  }

  return [
    'Order Placed',
    'Order Accepted',
    'Driver Pending',
    'Order Shipped',
    'In Transit',
    'Order Delivered',
    'Order Completed',
    'Order Cancelled',
  ]
}

function buildFulfillmentStats(rows: Array<Record<string, unknown>>) {
  const count = (predicate: (status: string) => boolean) =>
    rows.filter(row => predicate(readStatus(row))).length

  return {
    accepted: count(status => status === 'Order Accepted'),
    completed: count(isDeliveredStatus),
    driverAccepted: count(status => status === 'Driver Accepted'),
    driverPending: count(status => status === 'Driver Pending'),
    inTransit: count(status => status === 'In Transit' || status === 'In traffic'),
    needsDriverAction: count(status =>
      ['Order Accepted', 'Driver Pending', 'Driver Rejected'].includes(status),
    ),
    needsVendorAction: count(status => status === 'Order Placed'),
    placed: count(status => status === 'Order Placed'),
    problem: count(isCancelledStatus),
    shipped: count(status => status === 'Order Shipped' || status === 'Order Picked Up'),
  }
}

function buildProductIssue(
  product: Record<string, unknown>,
  entities: ReturnType<typeof getCommerceEntities>,
): CommerceReadinessIssue | null {
  const issues: string[] = []

  if (!hasMedia(product.photo ?? product.photos ?? product.details)) {
    issues.push('missing media')
  }

  if (readProductPrice(product) <= 0) {
    issues.push('missing price')
  }

  if (!readString(product.category) && !readString(product.categoryID)) {
    issues.push('missing category')
  }

  if (entities.vendors && !readString(product.vendorID)) {
    issues.push('missing restaurant')
  }

  if (!readString(product.description)) {
    issues.push('missing description')
  }

  if (issues.length === 0) {
    return null
  }

  const id = readString(product.id)

  return {
    href: `/admin/${entities.products?.route ?? 'products'}/${encodeURIComponent(id)}/view`,
    id,
    issues,
    label: readString(product.name) || id || 'Untitled product',
  }
}

function buildPromotionReport(
  orderRows: Array<Record<string, unknown>>,
  productRows: Array<Record<string, unknown>>,
) {
  const couponCounts = new Map<string, number>()
  let discountTotal = 0

  orderRows.forEach(order => {
    readCouponCodes(order).forEach(code => {
      couponCounts.set(code, (couponCounts.get(code) ?? 0) + 1)
    })
    discountTotal += readOrderDiscount(order)
  })

  return {
    activeSaleProducts: productRows.filter(product => isProductOnSale(product)).length,
    couponOrders: orderRows.filter(order => readCouponCodes(order).length > 0).length,
    discountTotal: roundCurrency(discountTotal),
    featuredProducts: productRows.filter(product =>
      product.featured === true || product.isFeatured === true,
    ).length,
    topCoupons: [...couponCounts.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6),
  }
}

function buildPayoutReport(rows: Array<Record<string, unknown>>) {
  const completedRows = rows.filter(row => isDeliveredStatus(readStatus(row)))
  const vendorMap = new Map<string, CommercePayoutSummary>()
  const driverMap = new Map<string, CommercePayoutSummary>()

  completedRows.forEach(order => {
    const total = readOrderTotal(order)
    const vendorId = readString(order.vendorID) || readNestedString(order.vendor, 'id') || 'unassigned'
    const driverId = readString(order.driverID) || readNestedString(order.driver, 'id') || 'unassigned'

    updatePayoutMap(vendorMap, vendorId, readVendorLabel(order), total)

    if (driverId !== 'unassigned') {
      updatePayoutMap(driverMap, driverId, readDriverLabel(order), total)
    }
  })

  const vendors = [...vendorMap.values()].sort((left, right) => right.grossRevenue - left.grossRevenue)
  const drivers = [...driverMap.values()].sort((left, right) => right.grossRevenue - left.grossRevenue)

  return {
    driverGross: roundCurrency(drivers.reduce((sum, item) => sum + item.grossRevenue, 0)),
    drivers: drivers.slice(0, 8),
    driversWithRevenue: drivers.length,
    pendingOrders: rows.filter(row => !isDeliveredStatus(readStatus(row)) && !isCancelledStatus(readStatus(row))).length,
    vendorGross: roundCurrency(vendors.reduce((sum, item) => sum + item.grossRevenue, 0)),
    vendors: vendors.slice(0, 8),
    vendorsWithRevenue: vendors.filter(item => item.id !== 'unassigned').length,
  }
}

function updatePayoutMap(
  map: Map<string, CommercePayoutSummary>,
  id: string,
  label: string,
  total: number,
) {
  const current = map.get(id) ?? {
    grossRevenue: 0,
    id,
    label: label || id,
    orders: 0,
  }

  current.grossRevenue = roundCurrency(current.grossRevenue + total)
  current.orders += 1
  map.set(id, current)
}

function buildInventoryIssue(
  product: Record<string, unknown>,
  entities: ReturnType<typeof getCommerceEntities>,
): CommerceReadinessIssue | null {
  const issues: string[] = []
  const stock = readProductStock(product)

  if (stock !== null && stock <= 0) {
    issues.push('out of stock')
  } else if (stock !== null && stock <= 5) {
    issues.push('low stock')
  }

  if (hasProductSkuField(product) && !readProductSku(product)) {
    issues.push('missing SKU')
  }

  if (issues.length === 0) {
    return null
  }

  const id = readString(product.id)

  return {
    href: `/admin/${entities.products?.route ?? 'products'}/${encodeURIComponent(id)}/view`,
    id,
    issues,
    label: readString(product.name) || readString(product.title) || id || 'Untitled product',
  }
}

function buildVendorIssue(
  vendor: Record<string, unknown>,
  entities: ReturnType<typeof getCommerceEntities>,
): CommerceReadinessIssue | null {
  const issues: string[] = []

  if (!hasMedia(vendor.photo ?? vendor.photos ?? vendor.photoURLs)) {
    issues.push('missing media')
  }

  if (!readString(vendor.address) && !readString(vendor.place) && !readString(vendor.location)) {
    issues.push('missing address')
  }

  if (!hasCoordinates(vendor)) {
    issues.push('missing coordinates')
  }

  if (!readString(vendor.authorID) && !vendor.author) {
    issues.push('missing owner')
  }

  if (issues.length === 0) {
    return null
  }

  const id = readString(vendor.id)

  return {
    href: entities.vendors ? `/admin/${entities.vendors.route}/${encodeURIComponent(id)}/view` : undefined,
    id,
    issues,
    label: readString(vendor.title) || readString(vendor.name) || id || 'Untitled restaurant',
  }
}

function buildDriverSummary(user: Record<string, unknown>): CommerceDriverSummary {
  const id = readString(user.id) || readString(user.userID) || readString(user.userId)
  const isActive = user.isActive === true
  const currentOrderId =
    readString(user.inProgressOrderID) ||
    readNestedString(user.orderRequestData, 'id')
  const issues: string[] = []

  if (isActive && !hasCoordinates(user.location)) {
    issues.push('missing live location')
  }

  if (!readString(user.email)) {
    issues.push('missing email')
  }

  if (currentOrderId) {
    issues.push('busy')
  }

  return {
    currentOrderId,
    email: readString(user.email),
    id,
    isActive,
    isBusy: Boolean(currentOrderId || user.orderRequestData),
    issues,
    name: readUserName(user) || readString(user.email) || id || 'Driver',
  }
}

function buildLaunchIssues({
  categoryCount,
  driverSummaries,
  entities,
  productIssues,
  productRows,
  vendorIssues,
  vendorRows,
}: {
  categoryCount: number
  driverSummaries: CommerceDriverSummary[]
  entities: ReturnType<typeof getCommerceEntities>
  productIssues: CommerceReadinessIssue[]
  productRows: Array<Record<string, unknown>>
  vendorIssues: CommerceReadinessIssue[]
  vendorRows: Array<Record<string, unknown>>
}) {
  const issues: string[] = []

  if (productRows.length === 0) {
    issues.push('Add products before launch.')
  }

  if (categoryCount === 0) {
    issues.push('Add categories so the mobile catalog can browse products.')
  }

  if (productIssues.length > 0) {
    issues.push('Fix product media, price, category, or description gaps.')
  }

  if (entities.vendors && vendorRows.length === 0) {
    issues.push('Add at least one restaurant/vendor.')
  }

  if (vendorIssues.length > 0) {
    issues.push('Fix restaurant media, owner, address, or coordinates.')
  }

  if (entities.deliveries && driverSummaries.length === 0) {
    issues.push('Add delivery drivers for fulfillment.')
  }

  if (
    entities.deliveries &&
    driverSummaries.length > 0 &&
    driverSummaries.every(driver => !driver.isActive)
  ) {
    issues.push('Set at least one delivery driver online.')
  }

  return issues
}

async function clearCommerceDriverOrder(
  order: Record<string, unknown>,
  usersEntity: AdminEntityConfig | undefined,
) {
  if (!usersEntity) {
    return
  }

  const driverId = readString(order.driverID) || readNestedString(order.driver, 'id')

  if (!driverId) {
    return
  }

  await getDocumentRef(usersEntity, driverId).set(
    {
      inProgressOrderID: null,
      orderRequestData: null,
      updatedAt: Date.now(),
    },
    { merge: true },
  )
}

function readCustomerLabel(order: Record<string, unknown>) {
  const snapshot = order.user ?? order.author
  const snapshotName = readSnapshotName(snapshot)

  return (
    snapshotName ||
    readString(order.user_id) ||
    readString(order.authorID) ||
    readString(order.customerID) ||
    'Unknown customer'
  )
}

function readDriverLabel(order: Record<string, unknown>) {
  return readSnapshotName(order.driver) || readString(order.driverID) || 'Unassigned'
}

function readVendorLabel(order: Record<string, unknown>) {
  return readSnapshotName(order.vendor) || readString(order.vendorID) || 'No restaurant'
}

function readSnapshotName(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  const record = value as Record<string, unknown>
  return (
    readString(record.title) ||
    readString(record.name) ||
    readUserName(record) ||
    readString(record.email) ||
    readString(record.username)
  )
}

function readUserName(record: Record<string, unknown>) {
  const names = [
    readString(record.firstName),
    readString(record.lastName),
  ].filter(Boolean)
  return names.join(' ')
}

function readOrderTotal(order: Record<string, unknown>) {
  return readNumber(
    order.totalPrice ??
      order.total ??
      order.price ??
      order.amount ??
      order.subtotal ??
      order.orderTotal,
  )
}

function readProductPrice(product: Record<string, unknown>) {
  return readNumber(product.price ?? product.regular_price ?? product.sale_price)
}

function readProductStock(product: Record<string, unknown>) {
  const stockValue =
    product.stock ??
    product.stock_quantity ??
    product.quantity ??
    product.inventory ??
    product.inventoryCount ??
    product.stockQuantity ??
    product.qty

  if (typeof stockValue === 'boolean') {
    return stockValue ? 1 : 0
  }

  if (stockValue === undefined && typeof product.in_stock === 'boolean') {
    return product.in_stock ? 1 : 0
  }

  if (stockValue === undefined || stockValue === null || stockValue === '') {
    return null
  }

  return readNumber(stockValue)
}

function hasProductSkuField(product: Record<string, unknown>) {
  return (
    Object.prototype.hasOwnProperty.call(product, 'sku') ||
    Object.prototype.hasOwnProperty.call(product, 'SKU') ||
    Object.prototype.hasOwnProperty.call(product, 'productSKU') ||
    Object.prototype.hasOwnProperty.call(product, 'barcode')
  )
}

function readProductSku(product: Record<string, unknown>) {
  return (
    readString(product.sku) ||
    readString(product.SKU) ||
    readString(product.productSKU) ||
    readString(product.barcode)
  )
}

function readStatus(row: Record<string, unknown>) {
  return readString(row.status) || 'Unknown'
}

function readPaymentStatus(order: Record<string, unknown>) {
  const status = readString(order.paymentStatus) || readString(order.financial_status)

  if (status) {
    return status
  }

  return order.selectedPaymentMethod ? 'Payment method saved' : 'Unknown'
}

function readRefundStatus(order: Record<string, unknown>) {
  return (
    readString(order.refundStatus) ||
    readString(order.adminRefundStatus) ||
    readString(order.refund_status) ||
    'none'
  ).toLowerCase()
}

function isRefundEligibleOrder(order: Record<string, unknown>) {
  return (
    readOrderTotal(order) > 0 &&
    readRefundStatus(order) !== 'refunded' &&
    (isCancelledStatus(readStatus(order)) || isUnpaidOrder(order) || readRefundStatus(order) !== 'none')
  )
}

function readCouponCodes(order: Record<string, unknown>) {
  const directCodes = [
    order.couponCode,
    order.coupon_code,
    order.discountCode,
    order.promoCode,
  ]
    .map(readString)
    .filter(Boolean)
  const arrayCodes = [
    ...readStringArray(order.coupons),
    ...readStringArray(order.couponCodes),
    ...readStringArray(order.discountCodes),
  ]

  return [...new Set([...directCodes, ...arrayCodes].map(code => code.toUpperCase()))]
}

function readOrderDiscount(order: Record<string, unknown>) {
  return readNumber(
    order.discountTotal ??
      order.discount_total ??
      order.discount ??
      order.couponDiscount ??
      order.totalDiscount,
  )
}

function isProductOnSale(product: Record<string, unknown>) {
  return (
    product.on_sale === true ||
    readString(product.onSale).toLowerCase() === 'true' ||
    readNumber(product.sale_price) > 0 ||
    readNumber(product.salePrice) > 0
  )
}

function isPaidOrder(order: Record<string, unknown>) {
  const status = readPaymentStatus(order)
  return /paid|success|completed|payment method saved/i.test(status)
}

function isUnpaidOrder(order: Record<string, unknown>) {
  const status = readPaymentStatus(order)
  return /unpaid|pending|failed|declined|cancelled|canceled/i.test(status)
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

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap(item => {
    if (typeof item === 'string') {
      return [item.trim()].filter(Boolean)
    }

    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      return [
        readString(record.code),
        readString(record.couponCode),
        readString(record.discountCode),
      ].filter(Boolean)
    }

    return []
  })
}

function readNestedString(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  return readString((value as Record<string, unknown>)[key])
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

function hasCoordinates(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    readNumber(record.latitude) !== 0 &&
    readNumber(record.longitude) !== 0
  )
}

function isPendingStatus(status: string) {
  return /placed|pending|accepted|shipped|transit|traffic|driver/i.test(status)
}

function isDeliveredStatus(status: string) {
  return /delivered|completed|picked up/i.test(status)
}

function isCancelledStatus(status: string) {
  return /cancelled|canceled|rejected|failed|refunded/i.test(status)
}

function isTerminalDriverStatus(status: string) {
  return isDeliveredStatus(status) || isCancelledStatus(status)
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}
