'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Gauge,
  Loader2,
  RefreshCw,
  Route,
  ShieldAlert,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TaxiDriverSummary {
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

interface TaxiTripSummary {
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

interface TaxiCarCategorySummary {
  id: string
  issues: string[]
  name: string
  pricing: string
  type: string
}

interface TaxiLaunchIssue {
  detail: string
  label: string
  severity: 'high' | 'low' | 'medium'
}

interface TaxiPayoutSummary {
  completedTrips: number
  driver: string
  driverId: string
  grossRevenue: number
}

interface TaxiOperationsOverview {
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

export default function Page() {
  const [driverSelections, setDriverSelections] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<TaxiOperationsOverview | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  async function loadOverview() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/taxi/overview', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; overview?: TaxiOperationsOverview }
        | null

      if (!response.ok || !data?.overview) {
        throw new Error(data?.error ?? 'Failed to load taxi operations.')
      }

      setOverview(data.overview)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load taxi operations.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  async function updateTripStatus(tripId: string, status: string) {
    setUpdatingKey(`trip:${tripId}`)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/taxi/trips/${encodeURIComponent(tripId)}/status`,
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
        throw new Error(data?.error ?? 'Failed to update taxi trip.')
      }

      await loadOverview()
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : 'Failed to update taxi trip.',
      )
    } finally {
      setUpdatingKey(null)
    }
  }

  async function clearTripStuckState(tripId: string) {
    setUpdatingKey(`clear:${tripId}`)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/taxi/trips/${encodeURIComponent(tripId)}/clear-stuck-state`,
        {
          credentials: 'include',
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to clear taxi trip stuck state.')
      }

      await loadOverview()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to clear taxi trip stuck state.',
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
        `/api/admin/taxi/drivers/${encodeURIComponent(driverId)}/availability`,
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

  async function assignDriver(tripId: string, driverId: string) {
    setUpdatingKey(`assign:${tripId}`)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/taxi/trips/${encodeURIComponent(tripId)}/assign-driver`,
        {
          body: JSON.stringify({ driverId }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to assign taxi driver.')
      }

      await loadOverview()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to assign taxi driver.',
      )
    } finally {
      setUpdatingKey(null)
    }
  }

  if (!overview && isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading taxi operations...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <Car className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Taxi Operations
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Trip lifecycle, driver readiness and launch pricing controls.
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
            Taxi Operations is available when a panel has trips and car categories.
          </CardContent>
        </Card>
      )}

      {overview?.isEnabled && (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              helper={`${overview.trips.active} active trips`}
              icon={Route}
              label="Trips"
              value={overview.trips.total}
            />
            <MetricCard
              helper={`${overview.dispatch.noDriverFound} no driver found`}
              icon={ShieldAlert}
              label="Dispatch"
              value={overview.dispatch.awaitingDriver}
            />
            <MetricCard
              helper={`${overview.drivers.available} available`}
              icon={Users}
              label="Drivers"
              value={overview.drivers.total}
            />
            <MetricCard
              helper={`${overview.payouts.completedTrips} completed trips`}
              icon={CreditCard}
              label="Revenue"
              value={overview.payouts.grossRevenue}
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.85fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base">Trip Queue</CardTitle>
                  {overview.entities.trips && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/${overview.entities.trips}`}>Open Trips</Link>
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.trips.recent.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No trips found.
                    </div>
                  )}
                  {overview.trips.recent.map(trip => (
                    <TripRow
                      availableDrivers={overview.drivers.recent.filter(driver => driver.isDispatchReady)}
                      driverSelection={driverSelections[trip.id] ?? ''}
                      key={trip.id}
                      onAssignDriver={assignDriver}
                      onClearStuckState={clearTripStuckState}
                      onDriverSelectionChange={driverId =>
                        setDriverSelections(current => ({
                          ...current,
                          [trip.id]: driverId,
                        }))
                      }
                      onStatusChange={updateTripStatus}
                      statusOptions={overview.statusOptions}
                      trip={trip}
                      tripsRoute={overview.entities.trips}
                      updatingKey={updatingKey}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Gauge className="h-4 w-4" />
                    Trip Lifecycle
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <SmallStat
                      label="Avg completed"
                      value={overview.lifecycle.averageCompletedMinutes}
                    />
                    <SmallStat label="Long running" value={overview.lifecycle.longRunningActive} />
                    <SmallStat
                      label="No price"
                      value={overview.lifecycle.completedWithoutPrice}
                    />
                    <SmallStat label="Rejected tries" value={overview.dispatch.rejectedDriverAttempts} />
                  </div>
                  {overview.lifecycle.activeTimeline.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No active trip timeline in the current sample.
                    </div>
                  )}
                  {overview.lifecycle.activeTimeline.slice(0, 6).map(trip => (
                    <div className="rounded-md border p-3 text-sm" key={`active:${trip.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate font-medium">{trip.passenger}</span>
                        <Badge variant={badgeVariantForStatus(trip.status)}>
                          {formatStatus(trip.status)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {trip.route} · {trip.durationMinutes} min · Driver: {trip.driver}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

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
                      Taxi launch readiness based on dispatch, drivers, pricing and payment data.
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
                    <ShieldAlert className="h-4 w-4" />
                    Dispatch Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <SmallStat label="Awaiting" value={overview.dispatch.awaitingDriver} />
                    <SmallStat label="Rejected" value={overview.dispatch.driverRejected} />
                    <SmallStat label="No driver" value={overview.dispatch.noDriverFound} />
                    <SmallStat label="Stale active" value={overview.dispatch.staleActiveTrips} />
                  </div>
                  {overview.dispatch.incidents.slice(0, 4).map(trip => (
                    <div className="rounded-md border p-3 text-sm" key={`incident:${trip.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate font-medium">{trip.passenger}</span>
                        <Badge variant={badgeVariantForStatus(trip.status)}>
                          {formatStatus(trip.status)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {trip.route} · {trip.rejectedDrivers} rejected
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Driver Fleet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <SmallStat label="Online" value={overview.drivers.online} />
                    <SmallStat label="Busy" value={overview.drivers.busy} />
                    <SmallStat label="Available" value={overview.drivers.available} />
                    <SmallStat label="Offline" value={overview.drivers.offline} />
                  </div>
                  {overview.drivers.recent.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No driver users found.
                    </div>
                  )}
                  {overview.drivers.recent.map(driver => (
                    <div className="rounded-md border p-3" key={driver.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{driver.name}</div>
                          <div className="truncate text-sm text-muted-foreground">
                            {driver.car} · {driver.email}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant={driver.isActive ? 'default' : 'secondary'}>
                              {driver.isActive ? 'online' : 'offline'}
                            </Badge>
                            {driver.isDispatchReady && <Badge variant="outline">dispatch ready</Badge>}
                            {driver.isBusy && <Badge variant="secondary">busy</Badge>}
                          </div>
                        </div>
                        <Button
                          disabled={Boolean(updatingKey)}
                          onClick={() => void updateDriverAvailability(driver.id, !driver.isActive)}
                          size="sm"
                          variant="outline"
                        >
                          {updatingKey === `driver:${driver.id}` && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {driver.isActive ? 'Offline' : 'Online'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Driver Onboarding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ReadinessRow
                    count={overview.drivers.readinessIssues.length}
                    label="Driver profile issues"
                  />
                  <ReadinessRow
                    count={overview.drivers.withoutLocation}
                    label="Drivers without live location"
                  />
                  <ReadinessRow
                    count={overview.drivers.withoutPhone}
                    label="Drivers without phone"
                  />
                  <ReadinessRow
                    count={overview.drivers.withoutProfilePhoto}
                    label="Drivers without profile photo"
                  />
                  <ReadinessRow
                    count={overview.drivers.withoutCarPhoto}
                    label="Drivers without car photo"
                  />
                  <ReadinessRow
                    count={overview.drivers.withoutCarType}
                    label="Drivers without car type"
                  />
                  {overview.drivers.readinessIssues.slice(0, 5).map(driver => (
                    <div className="rounded-md border p-3 text-sm" key={driver.id}>
                      <div className="truncate font-medium">{driver.name}</div>
                      <div className="text-muted-foreground">{driver.issues.join(', ')}</div>
                    </div>
                  ))}
                  {overview.entities.users && (
                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/admin/${overview.entities.users}`}>
                        Open Drivers
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pricing Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ReadinessRow
                    count={overview.carCategories.missingPricing}
                    label="Car types missing pricing"
                  />
                  <ReadinessRow
                    count={overview.carCategories.missingVisuals}
                    label="Car types missing visuals"
                  />
                  {overview.carCategories.recent.slice(0, 5).map(category => (
                    <div className="rounded-md border p-3 text-sm" key={category.id || category.type}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate font-medium">{category.name}</span>
                        <Badge variant={category.issues.length === 0 ? 'default' : 'destructive'}>
                          {category.type || 'missing type'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-muted-foreground">{category.pricing}</div>
                      {category.issues.length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {category.issues.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                  {overview.entities.carCategories && (
                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/admin/${overview.entities.carCategories}`}>
                        Open Car Categories
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4" />
                    Payments & Payouts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <SmallStat label="Cards" value={overview.payments.cardMethods} />
                    <SmallStat label="Cash trips" value={overview.payments.cashTrips} />
                    <SmallStat
                      label="No default"
                      value={overview.payments.customersWithoutDefaultPayment}
                    />
                    <SmallStat
                      label="Drivers paid"
                      value={overview.payouts.driversWithCompletedTrips}
                    />
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Gross completed revenue</span>
                      <span className="font-medium">{formatMoney(overview.payouts.grossRevenue)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Cash to collect</span>
                      <span className="font-medium">
                        {formatMoney(overview.payments.pendingCashCollection)}
                      </span>
                    </div>
                  </div>
                  {overview.payouts.recent.slice(0, 4).map(item => (
                    <div className="rounded-md border p-3 text-sm" key={item.driverId}>
                      <div className="truncate font-medium">{item.driver}</div>
                      <div className="text-muted-foreground">
                        {item.completedTrips} trips · {formatMoney(item.grossRevenue)}
                      </div>
                    </div>
                  ))}
                  {overview.entities.paymentMethods && (
                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/admin/${overview.entities.paymentMethods}`}>
                        Open Payment Methods
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {overview.trips.statusCounts.map(item => (
                    <div
                      className="flex items-center justify-between gap-3 text-sm"
                      key={item.status}
                    >
                      <span className="truncate text-muted-foreground">
                        {formatStatus(item.status)}
                      </span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                  {overview.trips.statusCounts.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      No trip statuses found.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TripRow({
  availableDrivers,
  driverSelection,
  onAssignDriver,
  onClearStuckState,
  onDriverSelectionChange,
  onStatusChange,
  statusOptions,
  trip,
  tripsRoute,
  updatingKey,
}: {
  availableDrivers: TaxiDriverSummary[]
  driverSelection: string
  onAssignDriver: (tripId: string, driverId: string) => Promise<void>
  onClearStuckState: (tripId: string) => Promise<void>
  onDriverSelectionChange: (driverId: string) => void
  onStatusChange: (tripId: string, status: string) => Promise<void>
  statusOptions: string[]
  trip: TaxiTripSummary
  tripsRoute?: string
  updatingKey: string | null
}) {
  const canAssignDriver = ['awaiting_driver', 'driver_rejected', 'no_driver_found'].includes(trip.status)
  const selectedDriverId = driverSelection || availableDrivers[0]?.id || ''

  return (
    <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_13rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {tripsRoute ? (
            <Link
              className="truncate font-medium hover:underline"
              href={`/admin/${tripsRoute}/${encodeURIComponent(trip.id)}/view`}
            >
              {trip.passenger}
            </Link>
          ) : (
            <span className="truncate font-medium">{trip.passenger}</span>
          )}
          <Badge variant={badgeVariantForStatus(trip.status)}>
            {formatStatus(trip.status)}
          </Badge>
        </div>
        <div className="mt-1 truncate text-sm text-muted-foreground">
          {trip.route} · {trip.type} · {formatMoney(trip.price)}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Driver: {trip.driver} · {trip.durationMinutes} min · {trip.paymentMethod}
          {trip.createdAt ? ` · ${new Date(trip.createdAt).toLocaleString()}` : ''}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {canAssignDriver && (
          <div className="grid gap-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              disabled={Boolean(updatingKey) || availableDrivers.length === 0}
              onChange={event => onDriverSelectionChange(event.target.value)}
              value={selectedDriverId}
            >
              {availableDrivers.length === 0 && <option value="">No drivers</option>}
              {availableDrivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} · {driver.carType || 'car'}
                </option>
              ))}
            </select>
            <Button
              disabled={Boolean(updatingKey) || !selectedDriverId}
              onClick={() => void onAssignDriver(trip.id, selectedDriverId)}
              size="sm"
              variant="outline"
            >
              {updatingKey === `assign:${trip.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Assign driver
            </Button>
          </div>
        )}
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          disabled={updatingKey === `trip:${trip.id}`}
          onChange={event => void onStatusChange(trip.id, event.target.value)}
          value={trip.status}
        >
          {statusOptions.map(status => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </select>
        <Button
          disabled={Boolean(updatingKey)}
          onClick={() => void onClearStuckState(trip.id)}
          size="sm"
          variant="outline"
        >
          {updatingKey === `clear:${trip.id}` ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          Clear stuck state
        </Button>
      </div>
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
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
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

function variantForSeverity(severity: TaxiLaunchIssue['severity']) {
  if (severity === 'high') {
    return 'destructive'
  }

  if (severity === 'medium') {
    return 'secondary'
  }

  return 'outline'
}

function badgeVariantForStatus(status: string) {
  if (/canceled|cancelled|rejected|no_driver/i.test(status)) {
    return 'destructive'
  }

  if (/accepted|started|completed/i.test(status)) {
    return 'default'
  }

  return 'secondary'
}

function formatStatus(status: string) {
  return status
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)
}
