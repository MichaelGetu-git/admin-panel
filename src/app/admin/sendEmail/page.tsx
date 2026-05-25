'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, Loader2, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface TemplateRecord {
  body?: string
  content?: string
  description?: string
  id: string
  html?: string
  name?: string
  subject?: string
  title?: string
}

export default function Page() {
  const [from, setFrom] = useState('')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [html, setHtml] = useState('')
  const [mode, setMode] = useState<'text' | 'html'>('text')
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)

  useEffect(() => {
    async function loadTemplates() {
      const response = await fetch('/api/admin/templates?limit=25', {
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as {
        items?: TemplateRecord[]
      } | null

      if (response.ok) {
        setTemplates(data?.items ?? [])
      }
    }

    void loadTemplates()
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/email/broadcast', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          html: mode === 'html' ? html : undefined,
          subject,
          text: mode === 'text' ? text : undefined,
          type: mode,
        }),
      })
      const data = (await response.json().catch(() => null)) as {
        error?: string
        recipients?: number
      } | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to send email.')
      }

      setMessage('Email queued for ' + String(data?.recipients ?? 0) + ' recipients.')
      setText('')
      setHtml('')
      setSelectedTemplateId('')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send email.')
    } finally {
      setIsLoading(false)
    }
  }

  function insertTemplate(templateId: string) {
    setSelectedTemplateId(templateId)

    const template = templates.find(item => item.id === templateId)
    if (!template) {
      return
    }

    const templateBody =
      readTemplateString(template.html) ||
      readTemplateString(template.body) ||
      readTemplateString(template.content)
    const templateSubject =
      readTemplateString(template.subject) ||
      readTemplateString(template.title) ||
      readTemplateString(template.name)

    if (templateBody) {
      setHtml(templateBody)
    }

    if (!subject && templateSubject) {
      setSubject(templateSubject)
    }

    setMode('html')
    setIsPreviewing(false)
  }

  return (
    <form className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6" onSubmit={onSubmit}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Email Broadcast</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a protected broadcast email to users with email addresses.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Compose Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="from">
                From
              </label>
              <Input
                id="from"
                onChange={event => setFrom(event.target.value)}
                placeholder="sender@example.com"
                required
                type="email"
                value={from}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="subject">
                Subject
              </label>
              <Input
                id="subject"
                onChange={event => setSubject(event.target.value)}
                required
                value={subject}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button
              className="w-full sm:w-auto"
              onClick={() => setMode('text')}
              type="button"
              variant={mode === 'text' ? 'default' : 'outline'}
            >
              Plain Text
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => setMode('html')}
              type="button"
              variant={mode === 'html' ? 'default' : 'outline'}
            >
              HTML
            </Button>
            <select
              className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60 sm:min-w-52"
              disabled={templates.length === 0}
              value={selectedTemplateId}
              onChange={event => insertTemplate(event.target.value)}
            >
              <option value="">
                {templates.length === 0 ? 'No templates found' : 'Insert template...'}
              </option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.title ?? template.name ?? template.subject ?? template.id}
                </option>
              ))}
            </select>
            <Button asChild className="w-full sm:w-auto" type="button" variant="ghost">
              <Link href="/admin/templates/add">New Template</Link>
            </Button>
            <Button asChild className="w-full sm:w-auto" type="button" variant="ghost">
              <Link href="/admin/templates">Manage Templates</Link>
            </Button>
          </div>

          {mode === 'text' ? (
            <Textarea
              onChange={event => setText(event.target.value)}
              placeholder="Enter your plain text message."
              required
              rows={10}
              value={text}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex justify-start sm:justify-end">
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => setIsPreviewing(current => !current)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {isPreviewing ? 'Edit' : 'Preview'}
                </Button>
              </div>
              {isPreviewing ? (
                <div
                  className="min-h-64 overflow-auto rounded-md border bg-muted/30 p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: html || '<p>No content to preview.</p>' }}
                />
              ) : (
                <Textarea
                  className="min-h-64"
                  onChange={event => setHtml(event.target.value)}
                  placeholder="Enter HTML email body."
                  required
                  rows={12}
                  value={html}
                />
              )}
            </div>
          )}

          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Email
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}

function readTemplateString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : ''
}
