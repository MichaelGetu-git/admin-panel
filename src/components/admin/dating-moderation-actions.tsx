'use client'

import { useState, type ComponentType } from 'react'
import { Eye, EyeOff, Loader2, RotateCcw, ShieldOff, Trash2 } from 'lucide-react'
import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import { Button } from '@/components/ui/button'

type RecordValue = Record<string, unknown> & { id?: string }

interface DatingModerationActionsProps {
  compact?: boolean
  entity: AdminEntityConfig
  onCompleted?: () => void
  record: RecordValue
}

export function DatingModerationActions({
  compact = false,
  entity,
  onCompleted,
  record,
}: DatingModerationActionsProps) {
  const [runningAction, setRunningAction] = useState<string | null>(null)

  if (adminPanelConfig.slug !== 'dating-app-admin-panel') {
    return null
  }

  const recordId = String(record.id ?? '')
  if (!recordId) {
    return null
  }

  const actions = getActions(entity, record, recordId)
  if (actions.length === 0) {
    return null
  }

  async function runAction(action: ModerationAction) {
    if (action.confirmMessage && !window.confirm(action.confirmMessage)) {
      return
    }

    setRunningAction(action.key)

    try {
      const response = await fetch(action.endpoint, {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Moderation action failed.')
      }

      onCompleted?.()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Moderation action failed.')
    } finally {
      setRunningAction(null)
    }
  }

  return (
    <div className={compact ? 'flex shrink-0 justify-end gap-1' : 'flex flex-wrap gap-2'}>
      {actions.map(action => {
        const Icon = action.icon
        const isRunning = runningAction === action.key

        return (
          <Button
            key={action.key}
            className={compact ? undefined : 'w-full sm:w-auto'}
            disabled={runningAction !== null}
            onClick={() => void runAction(action)}
            size={compact ? 'icon' : 'sm'}
            title={action.label}
            type="button"
            variant={action.variant}
          >
            {isRunning ? (
              <Loader2 className={compact ? 'h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />
            ) : (
              <Icon className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
            )}
            {!compact && action.label}
          </Button>
        )
      })}
    </div>
  )
}

interface ModerationAction {
  confirmMessage: string
  endpoint: string
  icon: ComponentType<{ className?: string }>
  key: string
  label: string
  variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

function getActions(
  entity: AdminEntityConfig,
  record: RecordValue,
  recordId: string,
): ModerationAction[] {
  if (entity.key === 'reports') {
    return [
      {
        confirmMessage: 'Unblock this user pair and remove all matching reports?',
        endpoint:
          '/api/admin/moderation/reports/' + encodeURIComponent(recordId) + '/unblock',
        icon: ShieldOff,
        key: 'unblock-report',
        label: 'Unblock',
        variant: 'outline',
      },
      {
        confirmMessage: 'Delete this report?',
        endpoint:
          '/api/admin/moderation/reports/' + encodeURIComponent(recordId) + '/delete',
        icon: Trash2,
        key: 'delete-report',
        label: 'Delete report',
        variant: 'destructive',
      },
    ]
  }

  if (entity.key === 'users') {
    const isHidden = isUserHidden(record)
    return [
      {
        confirmMessage: isHidden
          ? 'Show this user in dating recommendations again?'
          : 'Force-hide this user from dating recommendations?',
        endpoint:
          '/api/admin/moderation/users/' +
          encodeURIComponent(recordId) +
          (isHidden ? '/show' : '/hide'),
        icon: isHidden ? Eye : EyeOff,
        key: isHidden ? 'show-user' : 'hide-user',
        label: isHidden ? 'Show user' : 'Hide user',
        variant: isHidden ? 'outline' : 'destructive',
      },
    ]
  }

  if (entity.key === 'swipeCounts') {
    return [
      {
        confirmMessage: 'Reset this user swipe count to 0?',
        endpoint:
          '/api/admin/moderation/swipe-counts/' + encodeURIComponent(recordId) + '/reset',
        icon: RotateCcw,
        key: 'reset-swipe-count',
        label: 'Reset count',
        variant: 'outline',
      },
    ]
  }

  return []
}

function isUserHidden(record: RecordValue) {
  const settings = isObjectRecord(record.settings) ? record.settings : {}
  return settings.show_me === false || record.adminHidden === true || record.isHidden === true
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
