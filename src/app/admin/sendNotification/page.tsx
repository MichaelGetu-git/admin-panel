'use client'

import { FormEvent, useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from 'firebase/firestore'
import { Bell, ImageIcon, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getFirebaseFirestoreClient } from '@/lib/client/firebase'

// ── Types ────────────────────────────────────────────────────────────────────

interface NotificationRecord {
  id: string
  title: string
  body: string
  sentAt?: number
  status?: string
  sentCount?: number
  totalUsers?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(timestamp?: number) {
  if (!timestamp) return ''
  const d = new Date(timestamp * 1000)
  return (
    d.toLocaleDateString() +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page() {
  // Compose form state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [icon, setIcon] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Notification history state — same collection as mobile
  const [history, setHistory] = useState<NotificationRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // Real-time listener on admin_notifications (same as mobile onSnapshot)
  useEffect(() => {
    const db = getFirebaseFirestoreClient()
    const q = query(
      collection(db, 'admin_notifications'),
      orderBy('sentAt', 'desc'),
      limit(20),
    )
    const unsub = onSnapshot(
      q,
      snap => {
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }) as NotificationRecord))
        setHistoryLoading(false)
      },
      () => setHistoryLoading(false),
    )
    return () => unsub()
  }, [])

  // ── Upload icon ────────────────────────────────────────────────────────────

  async function uploadIcon(file: File) {
    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('photos', file)
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as {
        data?: Array<{ url: string }>
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Upload failed.')
      }

      setIcon(data?.data?.[0]?.url ?? '')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  // ── Send notification ──────────────────────────────────────────────────────

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setStatus(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon, message, title }),
      })
      const data = (await response.json().catch(() => null)) as {
        development?: boolean
        error?: string
        recipients?: number
      } | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to send notification.')
      }

      setStatus(
        data?.development
          ? 'No push tokens found.'
          : 'Notification sent to ' + String(data?.recipients ?? 0) + ' recipients.',
      )
      setTitle('')
      setMessage('')
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : 'Failed to send notification.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-10">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Push Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a push notification broadcast to all users.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {status && (
        <div className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {status}
        </div>
      )}

      {/* ── Compose card ── */}
      <form onSubmit={onSubmit}>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <Bell className="h-4 w-4" />
              Compose Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="notif-title">
                Title
              </label>
              <Input
                id="notif-title"
                placeholder="Title"
                onChange={e => setTitle(e.target.value)}
                required
                value={title}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="notif-message">
                Message body
              </label>
              <Textarea
                id="notif-message"
                placeholder="Message body…"
                onChange={e => setMessage(e.target.value)}
                required
                rows={5}
                value={message}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="notif-icon">
                Icon (optional)
              </label>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                {icon ? (
                  <img alt="" className="h-16 w-16 shrink-0 rounded-xl border object-cover" src={icon} />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed bg-muted">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <Input
                  accept="image/*"
                  disabled={isUploading}
                  id="notif-icon"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) void uploadIcon(file)
                  }}
                  type="file"
                  className="rounded-xl"
                />
              </div>
            </div>
            <Button
              className="w-full rounded-2xl py-6 text-sm font-bold uppercase tracking-wide"
              disabled={isLoading || isUploading || !title.trim() || !message.trim()}
              type="submit"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send to All Users
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* ── Sent History — same as mobile ── */}
      <section>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Sent History
        </p>

        {historyLoading && (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!historyLoading && history.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No notifications sent yet
          </p>
        )}

        {!historyLoading && history.length > 0 && (
          <div className="space-y-2.5">
            {history.map(item => (
              <div
                key={item.id}
                className="rounded-2xl border bg-card p-4"
              >
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-2 text-xs text-muted-foreground/70">
                  {formatDate(item.sentAt)}
                </p>
                <p className="mt-0.5 text-xs font-medium text-primary">
                  Sent to {item.sentCount ?? 0} / {item.totalUsers ?? 0} users
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
