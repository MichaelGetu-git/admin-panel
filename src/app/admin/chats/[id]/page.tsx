'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, MessageSquare, RefreshCw } from 'lucide-react'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const entity = getEntityConfig("channels")

type RecordValue = Record<string, unknown> & { id?: string }

export default function Page() {
  const params = useParams<{ id?: string | string[] }>()
  const router = useRouter()
  const channelId = Array.isArray(params.id) ? params.id[0] : params.id
  const [channel, setChannel] = useState<RecordValue | null>(null)
  const [messages, setMessages] = useState<RecordValue[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isMessageListCapped, setIsMessageListCapped] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadConversation = useCallback(async () => {
    if (!channelId) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const channelResponse = await fetch(
        '/api/admin/' + entity.route + '/' + encodeURIComponent(channelId),
        { credentials: 'include' },
      )

      if (channelResponse.status === 401) {
        router.replace('/login')
        return
      }

      const channelData = (await channelResponse.json().catch(() => null)) as {
        item?: RecordValue
        error?: string
      } | null

      if (!channelResponse.ok) {
        throw new Error(channelData?.error ?? 'Failed to load chat.')
      }

      const messagesData = await loadAllMessages(entity.route, channelId)
      if (messagesData.unauthorized) {
        router.replace('/login')
        return
      }

      setChannel(channelData?.item ?? null)
      setMessages(messagesData.items)
      setIsMessageListCapped(messagesData.capped)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load chat.')
    } finally {
      setIsLoading(false)
    }
  }, [channelId, router])

  useEffect(() => {
    void loadConversation()
  }, [loadConversation])

  const participants = useMemo(() => readStringArray(channel?.participantIDs), [channel])
  const title =
    readString(channel?.name) ||
    readString(channel?.title) ||
    readString(channel?.id) ||
    'Chat'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button asChild className="mb-4" size="sm" variant="ghost">
            <Link href={'/admin/' + entity.route}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{entity.collection}/thread</Badge>
            {channelId && (
              <Badge className="max-w-full min-w-0 truncate" variant="outline">
                {channelId}
              </Badge>
            )}
            <Badge variant="outline">{messages.length} messages loaded</Badge>
            {isMessageListCapped && (
              <Badge variant="outline">First 1000 messages</Badge>
            )}
          </div>
        </div>
        <Button
          disabled={isLoading}
          onClick={() => void loadConversation()}
          size="icon"
          title="Refresh"
          type="button"
          variant="outline"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chat Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="text-xs font-medium uppercase text-muted-foreground">
                Last Message
              </div>
              <div className="mt-1">{readString(channel?.lastMessage) || '-'}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-muted-foreground">
                Participants
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {participants.length > 0 ? (
                  participants.map(participant => (
                    <Badge key={participant} variant="outline">
                      {participant}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">No participants found.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No messages found.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-500 text-center mb-6">
                  This is a read-only view of the conversation between the participants.
                </div>
                <div className="flex flex-col space-y-4">
                  {messages.map((message) => {
                    const sender = readSender(message)
                    // If the database didn't record participants, infer the first one from the first message
                    const firstSender = participants.length > 0 ? participants[0] : readSender(messages[0] ?? message)
                    
                    const isFirstParticipant = 
                      message.senderID === firstSender || 
                      message.userID === firstSender || 
                      sender.includes(firstSender) ||
                      sender === firstSender

                    // Use alignRight if it's NOT the first participant
                    const alignRight = !isFirstParticipant
                    
                    return (
                      <div
                        key={String(message.id)}
                        className={`flex w-full ${alignRight ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`flex max-w-[80%] flex-col rounded-2xl px-4 py-2 text-sm ${
                            alignRight
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted rounded-bl-sm'
                          }`}
                        >
                          <div className={`mb-1 flex items-center gap-2 text-[10px] ${alignRight ? 'text-primary-foreground/70 justify-end' : 'text-muted-foreground'}`}>
                            <span className="font-semibold uppercase tracking-wider">{sender}</span>
                            <span>•</span>
                            <span>{formatDate(message.createdAt)}</span>
                          </div>
                          <div className="whitespace-pre-wrap wrap-break-word leading-relaxed">
                            {readMessageBody(message)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function loadAllMessages(route: string, channelId: string) {
  const items: RecordValue[] = []
  let collectionName = ''
  let cursor = ''

  for (let page = 0; page < 10; page += 1) {
    const searchParams = new URLSearchParams({
      direction: 'asc',
      limit: '100',
    })
    if (cursor) {
      searchParams.set('cursor', cursor)
    }
    if (collectionName) {
      searchParams.set('collectionName', collectionName)
    }

    const response = await fetch(
      '/api/admin/' +
        route +
        '/' +
        encodeURIComponent(channelId) +
        '/messages?' +
        searchParams.toString(),
      { credentials: 'include' },
    )

    if (response.status === 401) {
      return { capped: false, items, unauthorized: true }
    }

    const data = (await response.json().catch(() => null)) as {
      collectionName?: string | null
      error?: string
      items?: RecordValue[]
      nextCursor?: string | null
    } | null

    if (!response.ok) {
      throw new Error(data?.error ?? 'Failed to load messages.')
    }

    items.push(...(data?.items ?? []))
    collectionName = data?.collectionName ?? collectionName

    if (!data?.nextCursor) {
      return { capped: false, items, unauthorized: false }
    }

    cursor = data.nextCursor
  }

  return { capped: true, items, unauthorized: false }
}

function readSender(record: RecordValue) {
  return (
    readString(record.senderName) ||
    readString(record.authorName) ||
    readString(record.senderFirstName) ||
    readString(record.senderID) ||
    readString(record.userID) ||
    'Unknown user'
  )
}

function readMessageBody(record: RecordValue) {
  return (
    readString(record.content) ||
    readString(record.text) ||
    readString(record.message) ||
    readString(record.url) ||
    JSON.stringify(record, null, 2)
  )
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function formatDate(value: unknown) {
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}
