'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Package,
  Percent,
  RefreshCw,
  Receipt,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CommerceOverview {
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

interface CommerceDriverSummary {
  currentOrderId: string
  email: string
  id: string
  isActive: boolean
  isBusy: boolean
  issues: string[]
  name: string
}

interface CommerceOrderSummary {
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

interface CommerceReadinessIssue {
  href?: string
  id: string
  issues: string[]
  label: string
}

interface CommercePayoutSummary {
  grossRevenue: number
  id: string
  label: string
  orders: number
}

export default function Page() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<CommerceOverview | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  async function loadOverview() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/commerce/overview', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; overview?: CommerceOverview }
        | null

      if (!response.ok || !data?.overview) {
        throw new Error(data?.error ?? 'Failed to load commerce operations.')
      }

      setOverview(data.overview)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load commerce operations.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  async function updateOrderStatus(orderId: string, status: string) {
    setUpdatingKey(`order:${orderId}`)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/commerce/orders/${encodeURIComponent(orderId)}/status`,
        {
          body: JSON.stringify({ status }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to update order status.')
      }

      await loadOverview()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to update order status.',
      )
    } finally {
      setUpdatingKey(null)
    }
  }

  async function updateDriverAvailability(driverId: string, isActive: boolean) {
    setUpdatingKey(`driver:${driverId}`)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/commerce/drivers/${encodeURIComponent(driverId)}/availability`,
        {
          body: JSON.stringify({ isActive }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to update driver availability.')
      }

      await loadOverview()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to update driver availability.',
      )
    } finally {
      setUpdatingKey(null)
    }
  }

  async function updateRefundStatus(orderId: string, refundStatus: string) {
    setUpdatingKey(`refund:${orderId}:${refundStatus}`)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/commerce/orders/${encodeURIComponent(orderId)}/refund`,
        {
          body: JSON.stringify({ refundStatus }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to update refund status.')
      }

      await loadOverview()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to update refund status.',
      )
    } finally {
      setUpdatingKey(null)
    }
  }

  if (!overview && isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading commerce operations...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Commerce Operations
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Orders, catalog quality, fulfillment and driver readiness.
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
            Commerce Operations is available when a panel has products and orders.
          </CardContent>
        </Card>
      )}

      {overview?.isEnabled && (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={ShoppingCart}
              label="Orders"
              value={overview.orders.total}
              helper={`${overview.fulfillment.needsVendorAction} need vendor action`}
            />
            <MetricCard
              icon={CreditCard}
              label="Revenue"
              value={formatMoney(overview.orders.revenue)}
              helper={`${formatMoney(overview.orders.averageOrderValue)} average order`}
            />
            <MetricCard
              icon={Package}
              label="Catalog"
              value={overview.catalog.products}
              helper={`${overview.catalog.productIssues.length + overview.catalog.vendorIssues.length} readiness issues`}
            />
            <MetricCard
              icon={Truck}
              label="Drivers"
              value={overview.drivers.total}
              helper={`${overview.drivers.available} available`}
            />
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Percent className="h-4 w-4" />
                  Promotions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <SmallStat label="Sale products" value={overview.promotions.activeSaleProducts} />
                  <SmallStat label="Featured products" value={overview.promotions.featuredProducts} />
                  <SmallStat label="Coupon orders" value={overview.promotions.couponOrders} />
                  <SmallStat label="Discount total" value={formatMoney(overview.promotions.discountTotal)} />
                </div>
                <StatusList
                  empty="No coupon codes found in sampled orders."
                  items={overview.promotions.topCoupons.map(item => ({
                    count: item.count,
                    status: item.code,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4" />
                  Refund Ledger
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <SmallStat label="Requested" value={overview.refunds.requested} />
                  <SmallStat label="Pending" value={overview.refunds.pending} />
                  <SmallStat label="Refunded" value={overview.refunds.completed} />
                </div>
                {overview.refunds.eligible.length === 0 && (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No refund candidates found.
                  </div>
                )}
                {overview.refunds.eligible.slice(0, 4).map(order => (
                  <div className="rounded-md border p-3 text-sm" key={order.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        className="truncate font-medium hover:underline"
                        href={`/admin/${overview.entities.orders}/${encodeURIComponent(order.id)}/view`}
                      >
                        {order.id}
                      </Link>
                      <Badge variant={order.refundStatus === 'none' ? 'secondary' : 'outline'}>
                        {order.refundStatus}
                      </Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {formatMoney(order.total)} · {order.status}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(['requested', 'pending', 'refunded'] as const).map(status => (
                        <Button
                          disabled={updatingKey !== null}
                          key={status}
                          onClick={() => void updateRefundStatus(order.id, status)}
                          size="sm"
                          variant={order.refundStatus === status ? 'default' : 'outline'}
                        >
                          {updatingKey === `refund:${order.id}:${status}` && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4" />
                  Payout Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <SmallStat label="Vendor gross" value={formatMoney(overview.payouts.vendorGross)} />
                  <SmallStat label="Driver gross" value={formatMoney(overview.payouts.driverGross)} />
                  <SmallStat label="Vendors" value={overview.payouts.vendorsWithRevenue} />
                  <SmallStat label="Drivers" value={overview.payouts.driversWithRevenue} />
                </div>
                <PayoutList items={overview.payouts.vendors} title="Vendor revenue" />
                <PayoutList items={overview.payouts.drivers} title="Driver revenue" />
              </CardContent>
            </Card>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Fulfillment Pipeline</CardTitle>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/${overview.entities.orders}`}>Open Orders</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <PipelineStep label="Placed" value={overview.fulfillment.placed} />
                    <PipelineStep label="Accepted" value={overview.fulfillment.accepted} />
                    <PipelineStep label="Driver Pending" value={overview.fulfillment.driverPending} />
                    <PipelineStep label="Driver Accepted" value={overview.fulfillment.driverAccepted} />
                    <PipelineStep label="Shipped" value={overview.fulfillment.shipped} />
                    <PipelineStep label="In Transit" value={overview.fulfillment.inTransit} />
                    <PipelineStep label="Completed" value={overview.fulfillment.completed} />
                    <PipelineStep
                      label="Problems"
                      value={overview.fulfillment.problem}
                      variant={overview.fulfillment.problem > 0 ? 'destructive' : 'secondary'}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Order Queue</CardTitle>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{overview.orders.pending} pending</Badge>
                    <Badge variant="secondary">{overview.fulfillment.needsDriverAction} need driver</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.orders.recent.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No recent orders found.
                    </div>
                  )}
                  {overview.orders.recent.map(order => (
                    <div
                      key={order.id}
                      className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_13rem]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className="truncate font-medium hover:underline"
                            href={`/admin/${overview.entities.orders}/${encodeURIComponent(order.id)}/view`}
                          >
                            {order.id}
                          </Link>
                          <Badge variant={badgeVariantForStatus(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="mt-1 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                          <span className="truncate">{order.customer}</span>
                          <span className="truncate">{order.vendor}</span>
                          <span className="truncate">Driver: {order.driver}</span>
                          <span className="truncate">
                            {formatMoney(order.total)} · {order.paymentStatus}
                          </span>
                        </div>
                        {order.createdAt && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        disabled={updatingKey === `order:${order.id}`}
                        onChange={event => void updateOrderStatus(order.id, event.target.value)}
                        value={order.status}
                      >
                        {overview.statusOptions.map(status => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Launch Readiness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="text-sm text-muted-foreground">Score</div>
                    <div className="text-2xl font-semibold">{overview.launchReadiness.score}</div>
                  </div>
                  {overview.launchReadiness.issues.length === 0 ? (
                    <ReadinessRow count={0} label="Commerce launch blockers" />
                  ) : (
                    overview.launchReadiness.issues.map(issue => (
                      <div className="rounded-md border p-3 text-sm" key={issue}>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          <span>{issue}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Catalog Readiness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ReadinessRow
                    count={overview.catalog.missingPhoto}
                    label="Products without media"
                  />
                  <ReadinessRow
                    count={overview.catalog.missingPrice}
                    label="Products without valid price"
                  />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <SmallStat label="Categories" value={overview.catalog.categories} />
                    <SmallStat label="Restaurants" value={overview.catalog.vendors} />
                  </div>
                  <IssueList items={overview.catalog.productIssues} title="Product fixes" />
                  <IssueList items={overview.catalog.vendorIssues} title="Restaurant fixes" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/admin/${overview.entities.products}`}>Products</Link>
                    </Button>
                    {overview.entities.vendors && (
                      <Button asChild className="w-full" variant="outline">
                        <Link href={`/admin/${overview.entities.vendors}`}>Restaurants</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Inventory Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <SmallStat label="Tracked stock" value={overview.catalog.inventory.tracked} />
                    <SmallStat label="Out of stock" value={overview.catalog.inventory.outOfStock} />
                    <SmallStat label="Low stock" value={overview.catalog.inventory.lowStock} />
                    <SmallStat label="Missing SKU" value={overview.catalog.inventory.missingSku} />
                  </div>
                  <IssueList items={overview.catalog.inventory.issues} title="Inventory fixes" />
                  {overview.catalog.inventory.tracked === 0 && (
                    <div className="rounded-md border p-3 text-sm text-muted-foreground">
                      No stock fields were found in the sampled products.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Driver Fleet</CardTitle>
                {overview.entities.users && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/${overview.entities.users}`}>Open Users</Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <SmallStat label="Online" value={overview.drivers.online} />
                  <SmallStat label="Available" value={overview.drivers.available} />
                  <SmallStat label="Busy" value={overview.drivers.busy} />
                  <SmallStat label="Offline" value={overview.drivers.offline} />
                </div>
                {overview.drivers.recent.length === 0 && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    No delivery drivers found.
                  </div>
                )}
                <div className="grid gap-3 xl:grid-cols-2">
                  {overview.drivers.recent.map(driver => (
                    <div className="rounded-md border p-3" key={driver.id}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{driver.name}</div>
                          <div className="truncate text-sm text-muted-foreground">
                            {driver.email || driver.id}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant={driver.isActive ? 'default' : 'secondary'}>
                              {driver.isActive ? 'online' : 'offline'}
                            </Badge>
                            {driver.isBusy && <Badge variant="secondary">busy</Badge>}
                          </div>
                        </div>
                        <Button
                          disabled={updatingKey !== null}
                          onClick={() => void updateDriverAvailability(driver.id, !driver.isActive)}
                          size="sm"
                          variant={driver.isActive ? 'outline' : 'default'}
                        >
                          {updatingKey === `driver:${driver.id}` && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {driver.isActive ? 'Offline' : 'Online'}
                        </Button>
                      </div>
                      {driver.currentOrderId && (
                        <div className="mt-2 truncate text-xs text-muted-foreground">
                          Current order: {driver.currentOrderId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <IssueList items={overview.drivers.readinessIssues} title="Driver fixes" />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <SmallStat label="Paid" value={overview.payments.paid} />
                    <SmallStat label="Unpaid" value={overview.payments.unpaid} />
                    <SmallStat label="Unknown" value={overview.payments.unknown} />
                  </div>
                  <StatusList items={overview.payments.statuses} empty="No payment statuses found." />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusList items={overview.orders.statusCounts} empty="No order statuses found." />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Operations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SmallStat label="Active deliveries" value={overview.operations.activeDeliveries} />
                  <SmallStat label="Open reservations" value={overview.operations.openReservations} />
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {overview.entities.deliveries && (
                      <Button asChild className="w-full" variant="outline">
                        <Link href={`/admin/${overview.entities.deliveries}`}>Deliveries</Link>
                      </Button>
                    )}
                    {overview.entities.reservations && (
                      <Button asChild className="w-full" variant="outline">
                        <Link href={`/admin/${overview.entities.reservations}`}>Reservations</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
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
  value: number | string
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

function PipelineStep({
  label,
  value,
  variant = 'secondary',
}: {
  label: string
  value: number
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <span className="truncate text-sm text-muted-foreground">{label}</span>
      <Badge variant={variant}>{value}</Badge>
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
          <AlertTriangle className="h-4 w-4 text-destructive" />
        )}
        <span className="truncate">{label}</span>
      </div>
      <Badge variant={isReady ? 'default' : 'destructive'}>{count}</Badge>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function IssueList({
  items,
  title,
}: {
  items: CommerceReadinessIssue[]
  title: string
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      {items.slice(0, 5).map(item => (
        <div className="rounded-md border p-3 text-sm" key={item.id || item.label}>
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              {item.href ? (
                <Link className="truncate font-medium hover:underline" href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <div className="truncate font-medium">{item.label}</div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                {item.issues.join(', ')}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatusList({
  empty,
  items,
}: {
  empty: string
  items: Array<{ count: number; status: string }>
}) {
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">{empty}</div>
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div
          className="flex items-center justify-between gap-3 text-sm"
          key={item.status}
        >
          <span className="truncate text-muted-foreground">{item.status}</span>
          <Badge variant="secondary">{item.count}</Badge>
        </div>
      ))}
    </div>
  )
}

function PayoutList({
  items,
  title,
}: {
  items: CommercePayoutSummary[]
  title: string
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      {items.slice(0, 4).map(item => (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm" key={item.id}>
          <div className="min-w-0">
            <div className="truncate font-medium">{item.label}</div>
            <div className="text-xs text-muted-foreground">{item.orders} orders</div>
          </div>
          <Badge variant="secondary">{formatMoney(item.grossRevenue)}</Badge>
        </div>
      ))}
    </div>
  )
}

function badgeVariantForStatus(status: string) {
  if (/cancel|reject|fail|refund/i.test(status)) {
    return 'destructive'
  }

  if (/deliver|complete|picked/i.test(status)) {
    return 'default'
  }

  return 'secondary'
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)
}
