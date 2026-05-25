'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Save, Settings } from 'lucide-react'
import { adminPanelConfig, type AdminSettingsFieldConfig } from '@/generated/admin-panel.config'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface AdminAppSettings {
  [key: string]: string | undefined
  updatedAt?: string
  updatedBy?: string
}

const emptySettings: AdminAppSettings = Object.fromEntries(
  adminPanelConfig.settings.map(field => [field.key, String(field.defaultValue ?? '')]),
)

export default function Page() {
  const [settings, setSettings] = useState<AdminAppSettings>(emptySettings)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/admin/settings/app', {
          credentials: 'include',
        })
        const data = (await response.json().catch(() => null)) as
          | { error?: string; settings?: AdminAppSettings }
          | null

        if (!response.ok || !data?.settings) {
          throw new Error(data?.error ?? 'Failed to load app settings.')
        }

        setSettings({ ...emptySettings, ...data.settings })
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load app settings.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadSettings()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSaving(true)

    try {
      const response = await fetch('/api/admin/settings/app', {
        body: JSON.stringify(settings),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      })
      const data = (await response.json().catch(() => null)) as
        | { error?: string; settings?: AdminAppSettings }
        | null

      if (!response.ok || !data?.settings) {
        throw new Error(data?.error ?? 'Failed to save app settings.')
      }

      setSettings({ ...emptySettings, ...data.settings })
      setMessage('Settings saved.')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save app settings.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-md border bg-card p-2">
          <Settings className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            App Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Launch configuration for {adminPanelConfig.displayName}.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Launch Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              {adminPanelConfig.settings.map(field => (
                <label key={field.key} className="space-y-2 text-sm font-medium">
                  <span>
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </span>
                  <Input
                    disabled={isLoading || isSaving}
                    onChange={event =>
                      setSettings(current => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={getPlaceholder(field)}
                    type={getInputType(field)}
                    value={String(settings[field.key] ?? '')}
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                {settings.updatedAt
                  ? `Last updated ${new Date(settings.updatedAt).toLocaleString()}`
                  : 'No saved settings yet.'}
              </div>
              <Button disabled={isLoading || isSaving} type="submit">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function getInputType(field: AdminSettingsFieldConfig) {
  if (field.type === 'email') {
    return 'email'
  }

  if (field.type === 'phone') {
    return 'tel'
  }

  if (field.type === 'url') {
    return 'url'
  }

  return 'text'
}

function getPlaceholder(field: AdminSettingsFieldConfig) {
  if (field.key === 'appName') {
    return adminPanelConfig.theme.appName
  }

  if (field.key === 'brandName') {
    return adminPanelConfig.displayName
  }

  if (field.type === 'email') {
    return 'support@example.com'
  }

  if (field.type === 'phone') {
    return '+1 555 0100'
  }

  if (field.type === 'url') {
    return 'https://example.com'
  }

  if (field.type === 'color') {
    return '#111827'
  }

  return field.label
}
