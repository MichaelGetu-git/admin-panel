'use client'

import { FormEvent, useState } from 'react'
import { Bell, ImageIcon, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function Page() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [icon, setIcon] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

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
    <form className="mx-auto w-full max-w-2xl space-y-4 sm:space-y-6" onSubmit={onSubmit}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Push Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a protected FCM broadcast to users with push tokens.
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            New Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="title">
              Title
            </label>
            <Input
              id="title"
              onChange={event => setTitle(event.target.value)}
              required
              value={title}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="message">
              Message
            </label>
            <Textarea
              id="message"
              onChange={event => setMessage(event.target.value)}
              required
              rows={5}
              value={message}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="icon">
              Icon
            </label>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {icon ? (
                <img alt="" className="h-16 w-16 shrink-0 rounded-md border object-cover" src={icon} />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed bg-muted">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <Input
                accept="image/*"
                disabled={isUploading}
                id="icon"
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void uploadIcon(file)
                  }
                }}
                type="file"
              />
            </div>
          </div>
          <Button className="w-full" disabled={isLoading || isUploading} type="submit">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Notification
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
