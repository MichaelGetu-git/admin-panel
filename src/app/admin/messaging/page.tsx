'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  LifeBuoy,
  Loader2,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MessagingConversationSummary {
  id: string
  issues: string[]
  lastMessage: string
  lastMessageAt?: string
  name: string
  participantCount: number
  route?: string
  type: 'assistant' | 'group' | 'direct' | 'unknown'
}

interface MessagingMessageSummary {
  channelID: string
  content: string
  createdAt?: string
  flags: string[]
  id: string
  isAssistant: boolean
  kind: 'text' | 'media' | 'missed_call' | 'unknown'
  path: string
  sender: string
}

interface MessagingCallSummary {
  activeParticipants: number
  callType: string
  channelID: string
  channelName: string
  durationMinutes: number
  endedAt?: string
  id: string
  initiatedAt?: string
  issues: string[]
  startedAt?: string
  status: string
}

interface MessagingOperationsOverview {
  channels: {
    assistantChannels: number
    direct: number
    group: number
    recent: MessagingConversationSummary[]
    stale: number
    total: number
    withIssues: MessagingConversationSummary[]
  }
  entities: {
    avCallConnectionData?: string
    avCallStatuses?: string
    avCalls?: string
    channels?: string
  }
  gpt: {
    assistantMessages: number
    averageTokensPerPrompt: number
    enabled: boolean
    estimatedMonthlyCost: number
    estimatedSampleCost: number
    estimatedSampleTokens: number
    model: string
    openAIConfigured: boolean
    userPrompts: number
  }
  isEnabled: boolean
  messages: {
    flagged: MessagingMessageSummary[]
    media: number
    missedCalls: number
    recent: MessagingMessageSummary[]
    sampled: number
  }
  support: {
    escalated: MessagingConversationSummary[]
    needsHandoff: MessagingConversationSummary[]
    reviewed: number
    unreviewed: number
  }
  video: {
    activeCalls: MessagingCallSummary[]
    connectionEvents: number
    enabled: boolean
    failedCalls: MessagingCallSummary[]
    recentCalls: MessagingCallSummary[]
    statusCounts: Array<{ count: number; status: string }>
    statusDocuments: number
    totalCalls: number
  }
}

export default function Page() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<MessagingOperationsOverview | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  async function loadOverview() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/messaging/overview', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; overview?: MessagingOperationsOverview }
        | null

      if (!response.ok || !data?.overview) {
        throw new Error(data?.error ?? 'Failed to load messaging operations.')
      }

      setOverview(data.overview)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load messaging operations.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  async function runAction(resource: string, id: string, action: string) {
    setUpdatingKey(`${resource}:${id}:${action}`)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/messaging/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/action`,
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
        throw new Error(data?.error ?? 'Failed to update messaging resource.')
      }

      await loadOverview()
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Failed to update messaging resource.',
      )
    } finally {
      setUpdatingKey(null)
    }
  }

  if (!overview && isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading messaging operations...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border bg-card p-2">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Messaging Operations
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Conversation health, sampled message safety, GPT usage and video-call diagnostics.
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
            Messaging Operations is available for chat, GPT chat and video chat panels.
          </CardContent>
        </Card>
      )}

      {overview?.isEnabled && (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              helper={`${overview.channels.group} group, ${overview.channels.direct} direct`}
              icon={MessageCircle}
              label="Conversations"
              value={overview.channels.total}
            />
            <MetricCard
              helper={`${overview.messages.media} media, ${overview.messages.missedCalls} missed calls`}
              icon={CheckCircle2}
              label="Sampled Messages"
              value={overview.messages.sampled}
            />
            <MetricCard
              helper={`${overview.support.needsHandoff.length} support follow-ups`}
              icon={ShieldAlert}
              label="Safety Flags"
              value={overview.messages.flagged.length}
            />
            <MetricCard
              helper={
                overview.video.enabled
                  ? `${overview.video.activeCalls.length} active calls`
                  : `${overview.gpt.userPrompts} sampled prompts`
              }
              icon={overview.video.enabled ? PhoneCall : Bot}
              label={overview.video.enabled ? 'Video Calls' : 'GPT'}
              value={overview.video.enabled ? overview.video.totalCalls : overview.gpt.assistantMessages}
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Conversation Queue</CardTitle>
                {overview.entities.channels && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/${overview.entities.channels}`}>Open Chats</Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.channels.withIssues.length === 0 && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    No conversation issues found in the current sample.
                  </div>
                )}
                {overview.channels.withIssues.map(channel => (
                  <div className="rounded-md border p-3" key={channel.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {overview.entities.channels ? (
                            <Link
                              className="truncate font-medium hover:underline"
                              href={`/admin/${overview.entities.channels}/${encodeURIComponent(channel.id)}`}
                            >
                              {channel.name}
                            </Link>
                          ) : (
                            <span className="truncate font-medium">{channel.name}</span>
                          )}
                          <Badge variant="outline">{channel.type}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {channel.lastMessage || 'No last message'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {channel.issues.map(issue => (
                            <Badge key={issue} variant={issue === 'Escalated' ? 'destructive' : 'secondary'}>
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:shrink-0">
                        <ActionButton
                          action="mark_reviewed"
                          id={channel.id}
                          label="Reviewed"
                          resource="channels"
                          runAction={runAction}
                          updatingKey={updatingKey}
                        />
                        <ActionButton
                          action="mark_escalated"
                          id={channel.id}
                          label="Escalate"
                          resource="channels"
                          runAction={runAction}
                          updatingKey={updatingKey}
                          variant="destructive"
                        />
                        <ActionButton
                          action="mark_support_handoff"
                          id={channel.id}
                          label="Follow-up"
                          resource="channels"
                          runAction={runAction}
                          updatingKey={updatingKey}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Message Safety</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.messages.flagged.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No flagged messages found in sampled conversations.
                    </div>
                  )}
                  {overview.messages.flagged.slice(0, 6).map(message => (
                    <div className="rounded-md border p-3" key={message.path || message.id}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{message.sender}</p>
                          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                            {message.content || 'Empty message'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.flags.map(flag => (
                              <Badge key={flag} variant="secondary">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {overview.gpt.enabled && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">GPT Cost Dashboard</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniStat label="Sample cost" valueLabel={`$${overview.gpt.estimatedSampleCost}`} />
                      <MiniStat label="30-day projection" valueLabel={`$${overview.gpt.estimatedMonthlyCost}`} />
                    </div>
                    <KeyValue label="Model" value={overview.gpt.model} />
                    <KeyValue
                      label="OpenAI secret"
                      value={overview.gpt.openAIConfigured ? 'configured' : 'not configured'}
                    />
                    <KeyValue label="User prompts" value={overview.gpt.userPrompts} />
                    <KeyValue label="Assistant replies" value={overview.gpt.assistantMessages} />
                    <KeyValue label="Estimated tokens" value={overview.gpt.estimatedSampleTokens} />
                    <KeyValue label="Avg tokens / prompt" value={overview.gpt.averageTokensPerPrompt} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LifeBuoy className="h-4 w-4" />
                    Support Follow-up
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniStat label="Unreviewed" value={overview.support.unreviewed} />
                    <MiniStat label="Reviewed" value={overview.support.reviewed} />
                  </div>
                  {overview.support.needsHandoff.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No conversations are marked for support follow-up.
                    </div>
                  )}
                  {overview.support.needsHandoff.slice(0, 5).map(channel => (
                    <div className="rounded-md border p-3 text-sm" key={channel.id}>
                      <div className="truncate font-medium">{channel.name}</div>
                      <div className="mt-1 text-muted-foreground">
                        {channel.participantCount} participants · {channel.type}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ActionButton
                          action="mark_reviewed"
                          id={channel.id}
                          label="Reviewed"
                          resource="channels"
                          runAction={runAction}
                          updatingKey={updatingKey}
                        />
                        <ActionButton
                          action="clear_support_handoff"
                          id={channel.id}
                          label="Clear follow-up"
                          resource="channels"
                          runAction={runAction}
                          updatingKey={updatingKey}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {overview.video.enabled && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Video Call Diagnostics</CardTitle>
                {overview.entities.avCalls && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/${overview.entities.avCalls}`}>Open Calls</Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Status docs" value={overview.video.statusDocuments} />
                  <MiniStat label="Connection events" value={overview.video.connectionEvents} />
                  <MiniStat label="Failed or stale" value={overview.video.failedCalls.length} />
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Call Timeline</div>
                    {overview.video.recentCalls.slice(0, 6).map(call => (
                      <div className="rounded-md border p-3 text-sm" key={`timeline:${call.id}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="truncate font-medium">{call.channelName}</span>
                          <Badge variant="outline">{call.status}</Badge>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {call.callType} · {call.durationMinutes} min
                          {call.initiatedAt ? ` · ${formatDateLabel(call.initiatedAt)}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Statuses</div>
                    {overview.video.statusCounts.map(item => (
                      <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm" key={item.status}>
                        <span className="truncate text-muted-foreground">{item.status}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                {overview.video.failedCalls.length === 0 && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    No failed or stale call sessions found in the current sample.
                  </div>
                )}
                {overview.video.failedCalls.map(call => (
                  <div className="rounded-md border p-3" key={call.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {overview.entities.avCalls ? (
                            <Link
                              className="truncate font-medium hover:underline"
                              href={`/admin/${overview.entities.avCalls}/${encodeURIComponent(call.id)}`}
                            >
                              {call.channelName}
                            </Link>
                          ) : (
                            <span className="truncate font-medium">{call.channelName}</span>
                          )}
                          <Badge variant="outline">{call.status}</Badge>
                          <Badge variant="secondary">{call.callType}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {call.activeParticipants} active participants
                          {call.initiatedAt ? ` - ${formatDateLabel(call.initiatedAt)}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {call.issues.map(issue => (
                            <Badge key={issue} variant={issue === 'Escalated' ? 'destructive' : 'secondary'}>
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:shrink-0">
                        <ActionButton
                          action="mark_reviewed"
                          id={call.id}
                          label="Reviewed"
                          resource="calls"
                          runAction={runAction}
                          updatingKey={updatingKey}
                        />
                        <ActionButton
                          action="mark_escalated"
                          id={call.id}
                          label="Escalate"
                          resource="calls"
                          runAction={runAction}
                          updatingKey={updatingKey}
                          variant="destructive"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
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
  value: number
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className="rounded-md border bg-muted p-2">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({
  label,
  value,
  valueLabel,
}: {
  label: string
  value?: number
  valueLabel?: string
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">
        {valueLabel ?? (value ?? 0).toLocaleString()}
      </p>
    </div>
  )
}

function KeyValue({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  )
}

function ActionButton({
  action,
  id,
  label,
  resource,
  runAction,
  updatingKey,
  variant = 'outline',
}: {
  action: string
  id: string
  label: string
  resource: string
  runAction: (resource: string, id: string, action: string) => Promise<void>
  updatingKey: string | null
  variant?: 'destructive' | 'outline'
}) {
  const isUpdating = updatingKey === `${resource}:${id}:${action}`

  return (
    <Button
      disabled={isUpdating}
      onClick={() => void runAction(resource, id, action)}
      size="sm"
      variant={variant}
    >
      {isUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </Button>
  )
}

function formatDateLabel(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}
