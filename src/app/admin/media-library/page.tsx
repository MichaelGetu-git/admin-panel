'use client'

import { useState } from 'react'
import { CheckCircle2, Clipboard, ImageIcon, Loader2, UploadCloud } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface UploadedFile {
  mimetype: string
  name: string
  size: number
  url: string
}

export default function Page() {
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  async function uploadFiles() {
    if (files.length === 0) {
      setError('Select at least one media file.')
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })
      const response = await fetch('/api/admin/upload', {
        body: formData,
        credentials: 'include',
        method: 'POST',
      })
      const data = (await response.json().catch(() => null)) as
        | { data?: UploadedFile[]; error?: string; status?: boolean }
        | null

      if (!response.ok || !Array.isArray(data?.data)) {
        throw new Error(data?.error ?? 'Upload failed.')
      }

      setUploadedFiles(data.data)
      setFiles([])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  async function copyUrls() {
    await navigator.clipboard.writeText(uploadedFiles.map(file => file.url).join('\n'))
  }

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-start gap-3">
        <div className="rounded-md border bg-card p-2">
          <ImageIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Media Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bulk uploads for catalog, listing, profile and campaign assets.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UploadCloud className="h-4 w-4" />
              Upload Media
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              accept="image/*,video/*,audio/*"
              multiple
              onChange={event => setFiles(Array.from(event.target.files ?? []))}
              type="file"
            />
            <div className="flex flex-wrap gap-2">
              {files.map(file => (
                <Badge key={`${file.name}:${file.size}`} variant="secondary">
                  {file.name}
                </Badge>
              ))}
              {files.length === 0 && (
                <span className="text-sm text-muted-foreground">No files selected.</span>
              )}
            </div>
            <Button
              className="w-full"
              disabled={isUploading}
              onClick={() => void uploadFiles()}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Upload
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Uploaded Assets</CardTitle>
            <Badge variant="secondary">{uploadedFiles.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {uploadedFiles.length === 0 && (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No uploaded assets in this session.
              </div>
            )}
            {uploadedFiles.length > 0 && (
              <Button onClick={() => void copyUrls()} size="sm" variant="outline">
                <Clipboard className="h-4 w-4" />
                Copy URLs
              </Button>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {uploadedFiles.map(file => (
                <div className="rounded-md border p-3 text-sm" key={file.url}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="truncate font-medium">{file.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {file.mimetype || 'application/octet-stream'} · {formatBytes(file.size)}
                  </div>
                  <a
                    className="mt-2 block truncate text-xs text-primary underline-offset-4 hover:underline"
                    href={file.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {file.url}
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`
  }

  return `${Math.round((value / 1024 / 1024) * 10) / 10} MB`
}
