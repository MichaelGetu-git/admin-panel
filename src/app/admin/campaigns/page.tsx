'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, CalendarClock, Loader2, Mail, Megaphone, RefreshCw, Users } from 'lucide-react'
import { adminPanelConfig } from '@/generated/admin-panel.config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface CampaignSegment {
  count: number
  description: string
  id: string
  label: string
}

interface ScheduledCampaign {
  channel: 'email' | 'push'
  createdAt?: string
  id: string
  notes: string
  scheduledAt?: string
  segmentId: string
  status: string
  title: string
}

export default function Page() {
  const [channel, setChannel] = useState<'email' | 'push'>('email')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isScheduling, setIsScheduling] = useState(false)
  const [notes, setNotes] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduledCampaigns, setScheduledCampaigns] = useState<ScheduledCampaign[]>([])
  const [segmentId, setSegmentId] = useState('all')
  const [segments, setSegments] = useState<CampaignSegment[]>([])
  const [title, setTitle] = useState('')

  async function loadSegments() {
    setError(null)
    setIsLoading(true)

    try {
      const [segmentsResponse, scheduledResponse] = await Promise.all([
        fetch('/api/admin/campaigns/segments', { credentials: 'include' }),
        fetch('/api/admin/campaigns/scheduled', { credentials: 'include' }),
      ])
      const segmentsData = (await segmentsResponse.json().catch(() => null)) as
        | { error?: string; segments?: CampaignSegment[] }
        | null
      const scheduledData = (await scheduledResponse.json().catch(() => null)) as
        | { campaigns?: ScheduledCampaign[]; error?: string }
        | null

      if (!segmentsResponse.ok || !Array.isArray(segmentsData?.segments)) {
        throw new Error(segmentsData?.error ?? 'Failed to load campaign segments.')
      }

      if (!scheduledResponse.ok || !Array.isArray(scheduledData?.campaigns)) {
        throw new Error(scheduledData?.error ?? 'Failed to load scheduled campaigns.')
      }

      const loadedSegments = segmentsData.segments
      setSegments(loadedSegments)
      setScheduledCampaigns(scheduledData.campaigns)
      setSegmentId(current => current || loadedSegments[0]?.id || 'all')
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load campaign segments.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSegments()
  }, [])

  const hasEmail = adminPanelConfig.features.includes('email')
  const hasPush = adminPanelConfig.features.includes('push')
  const canScheduleChannel = channel === 'email' ? hasEmail : hasPush

  async function scheduleCampaign() {
    setError(null)
    setIsScheduling(true)

    try {
      const response = await fetch('/api/admin/campaigns/scheduled', {
        body: JSON.stringify({
          channel,
          notes,
          scheduledAt,
          segmentId,
          title,
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null

      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Failed to schedule campaign.')
      }

      setNotes('')
      setScheduledAt('')
      setTitle('')
      await loadSegments()
    } catch (scheduleError) {
      setError(
        scheduleError instanceof Error
          ? scheduleError.message
          : 'Failed to schedule campaign.',
      )
    } finally {
      setIsScheduling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Campaigns
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              User segments for email and push campaigns.
            </p>
          </div>
        </div>
        <Button disabled={isLoading} onClick={() => void loadSegments()} variant="outline">
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {segments.map(segment => (
          <Card key={segment.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{segment.label}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {isLoading ? '...' : segment.count}
              </div>
              <p className="mt-1 min-h-10 text-xs text-muted-foreground">
                {segment.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {hasEmail && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/admin/sendEmail">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </Link>
                  </Button>
                )}
                {hasPush && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/admin/sendNotification">
                      <Bell className="h-3.5 w-3.5" />
                      Push
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && segments.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No segments available.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant={hasEmail ? 'default' : 'secondary'}>
              Email {hasEmail ? 'enabled' : 'disabled'}
            </Badge>
            <Badge variant={hasPush ? 'default' : 'secondary'}>
              Push {hasPush ? 'enabled' : 'disabled'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              Schedule Campaign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Channel</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={event => setChannel(event.target.value === 'push' ? 'push' : 'email')}
                  value={channel}
                >
                  <option disabled={!hasEmail} value="email">Email</option>
                  <option disabled={!hasPush} value="push">Push</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Segment</span>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  onChange={event => setSegmentId(event.target.value)}
                  value={segmentId}
                >
                  {segments.map(segment => (
                    <option key={segment.id} value={segment.id}>
                      {segment.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Campaign Title</span>
              <Input
                onChange={event => setTitle(event.target.value)}
                placeholder="Launch announcement"
                value={title}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Scheduled At</span>
              <Input
                onChange={event => setScheduledAt(event.target.value)}
                type="datetime-local"
                value={scheduledAt}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Notes</span>
              <Textarea
                onChange={event => setNotes(event.target.value)}
                placeholder="Audience, offer, copy owner, approval notes"
                value={notes}
              />
            </label>
            <Button
              className="w-full"
              disabled={isScheduling || !canScheduleChannel}
              onClick={() => void scheduleCampaign()}
            >
              {isScheduling && <Loader2 className="h-4 w-4 animate-spin" />}
              Schedule
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Scheduled Campaigns</CardTitle>
            <Badge variant="secondary">{scheduledCampaigns.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {scheduledCampaigns.length === 0 && (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No scheduled campaigns found.
              </div>
            )}
            {scheduledCampaigns.map(campaign => (
              <div className="rounded-md border p-3 text-sm" key={campaign.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 font-medium">{campaign.title}</div>
                  <Badge variant="outline">{campaign.status}</Badge>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {campaign.channel} · {campaign.segmentId}
                  {campaign.scheduledAt ? ` · ${new Date(campaign.scheduledAt).toLocaleString()}` : ''}
                </div>
                {campaign.notes && (
                  <p className="mt-2 line-clamp-3 text-muted-foreground">{campaign.notes}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
