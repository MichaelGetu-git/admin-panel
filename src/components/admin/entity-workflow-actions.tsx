'use client'

import { useMemo, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  adminPanelConfig,
  type AdminActionConfig,
  type AdminEntityConfig,
  type AdminWorkflowConfig,
} from '@/generated/admin-panel.config'
import { canRunAdminAction } from '@/lib/admin-permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type RecordValue = Record<string, unknown> & { id?: string }

interface EntityWorkflowActionsProps {
  adminRole: string
  entity: AdminEntityConfig
  onCompleted?: () => void
  record: RecordValue
}

interface WorkflowAction {
  action: AdminActionConfig
  icon: ComponentType<{ className?: string }>
  variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  workflow: AdminWorkflowConfig
}

export function EntityWorkflowActions({
  adminRole,
  entity,
  onCompleted,
  record,
}: EntityWorkflowActionsProps) {
  const router = useRouter()
  const [runningActionId, setRunningActionId] = useState<string | null>(null)
  const recordId = String(record.id ?? '')
  const workflows = useMemo(() => getWorkflowActions(entity, adminRole), [adminRole, entity])

  if (!recordId || workflows.length === 0) {
    return null
  }

  async function runAction(workflowAction: WorkflowAction) {
    if (workflowAction.action.confirm && !window.confirm(`${workflowAction.action.label}?`)) {
      return
    }

    setRunningActionId(workflowAction.action.id)

    try {
      const response = await fetch(
        '/api/admin/' +
          entity.route +
          '/' +
          encodeURIComponent(recordId) +
          '/workflow',
        {
          body: JSON.stringify({
            actionId: workflowAction.action.id,
            workflowId: workflowAction.workflow.id,
          }),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      )
      const data = (await response.json().catch(() => null)) as
        | { deleted?: boolean; error?: string }
        | null

      if (!response.ok) {
        throw new Error(data?.error ?? 'Workflow action failed.')
      }

      if (data?.deleted) {
        router.replace('/admin/' + entity.route)
        router.refresh()
        return
      }

      onCompleted?.()
      router.refresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Workflow action failed.')
    } finally {
      setRunningActionId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workflows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {workflows.map(workflow => (
          <div
            key={workflow.workflow.id}
            className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{workflow.workflow.label}</div>
              {workflow.workflow.description && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {workflow.workflow.description}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {workflow.actions.map(workflowAction => {
                const Icon = workflowAction.icon
                const isRunning = runningActionId === workflowAction.action.id

                return (
                  <Button
                    className="gap-2"
                    disabled={runningActionId !== null}
                    key={workflowAction.action.id}
                    onClick={() => void runAction(workflowAction)}
                    size="sm"
                    type="button"
                    variant={workflowAction.variant}
                  >
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    {workflowAction.action.label}
                  </Button>
                )
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function getWorkflowActions(entity: AdminEntityConfig, adminRole: string) {
  return adminPanelConfig.workflows
    .filter(workflow => workflow.entity === entity.key || workflow.entity === entity.route)
    .map(workflow => {
      const actions = workflow.actions
        .map(actionId => adminPanelConfig.actions.find(action => action.id === actionId))
        .filter((action): action is AdminActionConfig => Boolean(action))
        .filter(
          action =>
            isSupportedWorkflowAction(action, entity) &&
            canRunAdminAction(adminRole, entity, action),
        )
        .map(action => ({
          action,
          icon: getActionIcon(action),
          variant: getActionVariant(action),
          workflow,
        }))

      return {
        actions,
        workflow,
      }
    })
    .filter(workflow => workflow.actions.length > 0)
}

function isSupportedWorkflowAction(action: AdminActionConfig, entity: AdminEntityConfig) {
  const targetsEntity = action.entity === entity.key || action.entity === entity.route

  if (!targetsEntity) {
    return false
  }

  if (action.type === 'setField') {
    return Boolean(action.field && entity.fields[action.field])
  }

  if (action.type === 'server') {
    return Boolean(action.serverAction)
  }

  return action.type === 'bulk' && action.operation === 'delete'
}

function getActionIcon(action: AdminActionConfig) {
  const key = `${action.id} ${action.label} ${action.field ?? ''}`.toLowerCase()

  if (key.includes('hide')) {
    return EyeOff
  }

  if (key.includes('show')) {
    return Eye
  }

  if (key.includes('feature')) {
    return Star
  }

  if (key.includes('disable') || key.includes('reject') || key.includes('ban')) {
    return XCircle
  }

  if (key.includes('reset') || key.includes('recompute')) {
    return RotateCcw
  }

  if (key.includes('delete')) {
    return Trash2
  }

  if (key.includes('verify') || key.includes('approve')) {
    return ShieldCheck
  }

  return CheckCircle2
}

function getActionVariant(action: AdminActionConfig): WorkflowAction['variant'] {
  const key = `${action.id} ${action.label}`.toLowerCase()

  if (key.includes('delete') || key.includes('ban')) {
    return 'destructive'
  }

  if (key.includes('hide') || key.includes('disable') || key.includes('reject')) {
    return 'outline'
  }

  return 'default'
}
