'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Stethoscope,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AppointmentBookingSummary {
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

interface ProviderReadinessIssue {
  id: string
  issue: string
  title: string
}

interface AppointmentProfessionalSummary {
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

interface AppointmentLaunchIssue {
  detail: string
  label: string
  severity: 'high' | 'low' | 'medium'
}

interface AppointmentOperationsOverview {
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
    withoutProvider: number
    withoutSkills: number
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

export default function Page() {
  const [error, setError] = useState<string | null>(null)
  const [availabilityDate, setAvailabilityDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [availabilityProfessionalId, setAvailabilityProfessionalId] = useState('')
  const [availabilityTime, setAvailabilityTime] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<AppointmentOperationsOverview | null>(null)
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null)

  async function loadOverview() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/appointments/overview', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; overview?: AppointmentOperationsOverview }
        | null

      if (!response.ok || !data?.overview) {
        throw new Error(data?.error ?? 'Failed to load appointment operations.')
      }

      const nextOverview = data.overview
      setOverview(nextOverview)
      setAvailabilityProfessionalId(current =>
        current || nextOverview.professionals.recent[0]?.id || '',
      )
      setAvailabilityTime(current =>
        current || nextOverview.availability.defaultSlots[0] || '',
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load appointment operations.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  async function updateBookingStatus(bookingId: string, status: string) {
    setUpdatingBookingId(bookingId)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/appointments/bookings/${encodeURIComponent(bookingId)}/status`,
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
        throw new Error(data?.error ?? 'Failed to update appointment status.')
      }

      await loadOverview()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to update appointment status.',
      )
    } finally {
      setUpdatingBookingId(null)
    }
  }

  async function blockAvailabilitySlot() {
    setUpdatingBookingId('availability:block')
    setError(null)

    try {
      const response = await fetch('/api/admin/appointments/availability/block', {
        body: JSON.stringify({
          date: availabilityDate,
          professionalId: availabilityProfessionalId,
          time: availabilityTime,
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to block appointment slot.')
      }

      await loadOverview()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to block appointment slot.',
      )
    } finally {
      setUpdatingBookingId(null)
    }
  }

  if (!overview && isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading appointment operations...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Appointment Operations
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Booking schedule, provider readiness and appointment status controls.
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
            Appointment Operations is available when a panel has bookings and providers.
          </CardContent>
        </Card>
      )}

      {overview?.isEnabled && (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              helper={`${overview.bookings.upcoming} upcoming`}
              icon={CalendarDays}
              label="Bookings"
              value={overview.bookings.total}
            />
            <MetricCard
              helper={`${overview.bookings.pending} need confirmation`}
              icon={Clock}
              label="Today"
              value={overview.bookings.today}
            />
            <MetricCard
              helper={`${overview.providers.readinessIssues.length} readiness issues sampled`}
              icon={Stethoscope}
              label="Providers"
              value={overview.providers.total}
            />
            <MetricCard
              helper={`${overview.professionals.featured} featured`}
              icon={Star}
              label="Professionals"
              value={overview.professionals.total}
            />
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" />
                Availability Editor
              </CardTitle>
              {overview.entities.bookings && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/${overview.entities.bookings}`}>Open Calendar Data</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_10rem_10rem_auto]">
                <select
                  className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                  onChange={event => setAvailabilityProfessionalId(event.target.value)}
                  value={availabilityProfessionalId}
                >
                  {overview.professionals.recent.map(professional => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  onChange={event => setAvailabilityDate(event.target.value)}
                  type="date"
                  value={availabilityDate}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  onChange={event => setAvailabilityTime(event.target.value)}
                  value={availabilityTime}
                >
                  {overview.availability.defaultSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
                <Button
                  disabled={
                    updatingBookingId !== null ||
                    !availabilityProfessionalId ||
                    !availabilityDate ||
                    !availabilityTime
                  }
                  onClick={() => void blockAvailabilitySlot()}
                >
                  {updatingBookingId === 'availability:block' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Block Slot
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <AvailabilityList
                  items={overview.availability.nextOpenSlots.map(slot => ({
                    detail: `${slot.date} · ${slot.time}`,
                    label: slot.professional,
                  }))}
                  title="Next Open Slots"
                />
                <AvailabilityList
                  items={overview.availability.blockedSlots.map(slot => ({
                    detail: `${slot.time} · ${slot.status}`,
                    label: slot.professional,
                  }))}
                  title="Blocked Slots"
                />
                <AvailabilityList
                  items={overview.availability.fullyBookedDays.map(day => ({
                    detail: day.date,
                    label: day.professional,
                  }))}
                  title="Fully Booked Days"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base">Booking Queue</CardTitle>
                  {overview.entities.bookings && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/${overview.entities.bookings}`}>Open Bookings</Link>
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.bookings.recent.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No bookings found.
                    </div>
                  )}
                  {overview.bookings.recent.map(booking => (
                    <BookingRow
                      booking={booking}
                      bookingsRoute={overview.entities.bookings}
                      key={booking.id}
                      onStatusChange={updateBookingStatus}
                      statusOptions={overview.statusOptions}
                      updatingBookingId={updatingBookingId}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base">Professional Roster</CardTitle>
                  {overview.entities.users && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/${overview.entities.users}`}>Open Users</Link>
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <SmallStat label="Featured" value={overview.professionals.featured} />
                    <SmallStat label="No provider" value={overview.professionals.withoutProvider} />
                    <SmallStat label="No skills" value={overview.professionals.withoutSkills} />
                    <SmallStat label="No price" value={overview.professionals.withoutPrice} />
                  </div>
                  {overview.professionals.recent.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No professional users found.
                    </div>
                  )}
                  {overview.professionals.recent.map(professional => (
                    <div className="rounded-md border p-3" key={professional.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium">{professional.name}</span>
                            {professional.isFeatured && <Badge>featured</Badge>}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {[professional.specialty, professional.price, professional.email]
                              .filter(Boolean)
                              .join(' · ') || 'Profile metadata missing'}
                          </div>
                          {professional.issues.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {professional.issues.join(', ')}
                            </div>
                          )}
                        </div>
                        {professional.id && overview.entities.users && (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/admin/${overview.entities.users}/${encodeURIComponent(professional.id)}/view`}
                            >
                              View
                            </Link>
                          </Button>
                        )}
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
                      Appointment setup readiness based on mobile data dependencies.
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
                    <Bell className="h-4 w-4" />
                    Reminders & No-shows
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <SmallStat label="Next 24h" value={overview.reminders.next24h} />
                    <SmallStat
                      label="Unconfirmed"
                      value={overview.reminders.unconfirmedUpcoming}
                    />
                    <SmallStat
                      label="Rescheduled"
                      value={overview.reminders.rescheduledUpcoming}
                    />
                    <SmallStat label="No-show risk" value={overview.noShows.count} />
                  </div>
                  {overview.reminders.needsReminder.slice(0, 4).map(booking => (
                    <div className="rounded-md border p-3 text-sm" key={booking.id}>
                      <div className="truncate font-medium">{booking.customer}</div>
                      <div className="text-muted-foreground">
                        {booking.time} · {booking.status}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upcoming Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.schedule.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No upcoming bookings in the current sample.
                    </div>
                  )}
                  {overview.schedule.map(day => (
                    <div className="rounded-md border p-3" key={day.date}>
                      <div className="font-medium">{formatScheduleDate(day.date)}</div>
                      <div className="mt-2 space-y-2">
                        {day.items.map(item => (
                          <div className="text-sm" key={item.id}>
                            <div className="truncate">{item.customer}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.time} · {item.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Provider Readiness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ReadinessRow
                    count={overview.providers.withoutPhoto}
                    label="Providers without photos"
                  />
                  <ReadinessRow
                    count={overview.providers.withoutLocation}
                    label="Providers without location"
                  />
                  <ReadinessRow
                    count={overview.providers.withoutPrice}
                    label="Providers without price"
                  />
                  <ReadinessRow
                    count={overview.providers.withoutCategory}
                    label="Providers without category"
                  />
                  {overview.providers.readinessIssues.slice(0, 5).map(issue => (
                    <div className="rounded-md border p-3 text-sm" key={`${issue.id}:${issue.issue}`}>
                      <div className="truncate font-medium">{issue.title}</div>
                      <div className="text-muted-foreground">{issue.issue}</div>
                    </div>
                  ))}
                  {overview.entities.providers && (
                    <Button asChild className="w-full" variant="outline">
                      <Link href={`/admin/${overview.entities.providers}`}>
                        Open Providers
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
                  {overview.bookings.statusCounts.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      No booking statuses found.
                    </div>
                  )}
                  {overview.bookings.statusCounts.map(item => (
                    <div
                      className="flex items-center justify-between gap-3 text-sm"
                      key={item.status}
                    >
                      <span className="truncate text-muted-foreground">{item.status}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function BookingRow({
  booking,
  bookingsRoute,
  onStatusChange,
  statusOptions,
  updatingBookingId,
}: {
  booking: AppointmentBookingSummary
  bookingsRoute?: string
  onStatusChange: (bookingId: string, status: string) => Promise<void>
  statusOptions: string[]
  updatingBookingId: string | null
}) {
  return (
    <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_12rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {bookingsRoute ? (
            <Link
              className="truncate font-medium hover:underline"
              href={`/admin/${bookingsRoute}/${encodeURIComponent(booking.id)}/view`}
            >
              {booking.customer}
            </Link>
          ) : (
            <span className="truncate font-medium">{booking.customer}</span>
          )}
          <Badge variant={badgeVariantForStatus(booking.status)}>{booking.status}</Badge>
          {booking.adminAvailabilityHold && <Badge variant="outline">hold</Badge>}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {booking.professional} · {booking.type} · {booking.time}
        </div>
        {booking.appointmentAt && (
          <div className="mt-1 text-xs text-muted-foreground">
            {new Date(booking.appointmentAt).toLocaleString()}
          </div>
        )}
      </div>
      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        disabled={updatingBookingId === booking.id}
        onChange={event => void onStatusChange(booking.id, event.target.value)}
        value={booking.status}
      >
        {statusOptions.map(status => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  )
}

function AvailabilityList({
  items,
  title,
}: {
  items: Array<{ detail: string; label: string }>
  title: string
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      {items.length === 0 && (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          None found.
        </div>
      )}
      {items.slice(0, 5).map(item => (
        <div className="rounded-md border p-3 text-sm" key={`${item.label}:${item.detail}`}>
          <div className="truncate font-medium">{item.label}</div>
          <div className="mt-1 text-muted-foreground">{item.detail}</div>
        </div>
      ))}
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

function variantForSeverity(severity: AppointmentLaunchIssue['severity']) {
  if (severity === 'high') {
    return 'destructive'
  }

  if (severity === 'medium') {
    return 'secondary'
  }

  return 'outline'
}

function badgeVariantForStatus(status: string) {
  if (/canceled|cancelled/i.test(status)) {
    return 'destructive'
  }

  if (/confirmed|completed/i.test(status)) {
    return 'default'
  }

  return 'secondary'
}

function formatScheduleDate(value: string) {
  if (value === 'Unscheduled') {
    return value
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  })
}
