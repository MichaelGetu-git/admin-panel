import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import {
  adminPanelConfig,
  type AdminActionConfig,
  type AdminEntityConfig,
} from '@/generated/admin-panel.config'
import { serverActionPermission } from '@/lib/admin-permissions'
import { updateAppointmentBookingStatus } from './appointment-operations'
import type { AdminSessionUser } from './auth'
import { writeAuditLog } from './audit-log'
import {
  updateCommerceDriverAvailability,
  updateCommerceOrderStatus,
} from './commerce'
import { runDatingSafetyAction } from './dating-safety'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { HttpError } from './http'
import { runListingOperationAction } from './listing-operations'
import { runMessagingOperationAction } from './messaging-operations'
import {
  assertAdminPermission,
  assertCanReadEntity,
  assertCanWriteEntity,
} from './permissions'
import {
  applySocialModerationAction,
  type SocialModerationAction,
} from './social-moderation'
import { applySupportUserAction } from './support'
import {
  clearTaxiTripStuckState,
  updateTaxiDriverAvailability,
  updateTaxiTripStatus,
} from './taxi-operations'
import {
  assertWritable,
  clampLimit,
  getDocumentRef,
  hasCollectionGroups,
  sanitizeWriteData,
  searchEntities,
  serializeDocument,
} from './firestore-crud-utils'

export async function listEntities(
  entity: AdminEntityConfig,
  searchParams: URLSearchParams,
  actor: AdminSessionUser,
) {
  assertCanReadEntity(actor, entity)

  const db = getFirebaseAdminFirestore()
  const limit = clampLimit(searchParams.get('limit'))
  const orderBy = searchParams.get('orderBy') ?? entity.orderBy?.field
  const direction =
    (searchParams.get('direction') ?? entity.orderBy?.direction) === 'asc'
      ? 'asc'
      : 'desc'
  const canOrder = Boolean(orderBy && entity.fields[orderBy as keyof typeof entity.fields])
  const searchTerm = searchParams.get('search')?.trim()

  if (searchTerm && !hasCollectionGroups(entity)) {
    const result = await searchEntities(db, entity, searchTerm, limit)
    if (result) {
      return result
    }
  }

  if (hasCollectionGroups(entity)) {
    const snapshots = await Promise.all(
      entity.collectionGroups.map(collectionGroup => {
        let groupQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
          db.collectionGroup(collectionGroup)

        if (canOrder && orderBy) {
          groupQuery = groupQuery.orderBy(orderBy, direction)
        }

        return groupQuery.limit(limit).get()
      }),
    )

    return {
      items: snapshots
        .flatMap(snapshot => snapshot.docs)
        .map(doc => serializeDocument(doc, true))
        .slice(0, limit),
      nextCursor: null,
    }
  }

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
    db.collection(entity.collection)

  if (canOrder && orderBy) {
    query = query.orderBy(orderBy, direction)
  }
  query = query.limit(limit)

  const snapshot = await query.get()
  const items = snapshot.docs.map(doc => serializeDocument(doc))
  const last = snapshot.docs.at(-1)

  return {
    items,
    nextCursor: last?.id ?? null,
  }
}

export async function getEntity(
  entity: AdminEntityConfig,
  id: string,
  actor: AdminSessionUser,
) {
  assertCanReadEntity(actor, entity)

  const doc = await getDocumentRef(entity, id).get()

  if (!doc.exists) {
    throw new HttpError('Not found.', 404)
  }

  return serializeDocument(doc, hasCollectionGroups(entity))
}

export async function createEntity(
  entity: AdminEntityConfig,
  data: Record<string, unknown>,
  actor: AdminSessionUser,
) {
  assertCanWriteEntity(actor, entity)
  assertWritable(entity)

  const db = getFirebaseAdminFirestore()
  if (hasCollectionGroups(entity)) {
    throw new HttpError('Collection group entities require a parent document path.', 405)
  }

  const ref =
    typeof data.id === 'string' && data.id.length > 0
      ? db.collection(entity.collection).doc(data.id)
      : db.collection(entity.collection).doc()

  const document = sanitizeWriteData(data)
  await ref.set({
    ...document,
    id: ref.id,
    ...buildCreateAuditFields(entity),
  })
  await writeAuditLog({
    action: 'entity.create',
    actor,
    metadata: {
      fields: Object.keys(document).sort(),
    },
    resourceId: ref.id,
    resourcePath: `${entity.collection}/${ref.id}`,
    resourceType: entity.key,
  })

  return { success: true, id: ref.id }
}

export async function updateEntity(
  entity: AdminEntityConfig,
  id: string,
  data: Record<string, unknown>,
  actor: AdminSessionUser,
) {
  assertCanWriteEntity(actor, entity)
  assertWritable(entity)

  const document = sanitizeWriteData(data)
  const ref = getDocumentRef(entity, id)
  await ref.set(
    {
      ...document,
      ...buildUpdateAuditFields(entity),
    },
    { merge: true },
  )
  await writeAuditLog({
    action: 'entity.update',
    actor,
    metadata: {
      fields: Object.keys(document).sort(),
    },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entity.key,
  })

  return { success: true, id }
}

export async function deleteEntity(
  entity: AdminEntityConfig,
  id: string,
  actor: AdminSessionUser,
) {
  assertCanWriteEntity(actor, entity)
  assertWritable(entity)

  const ref = getDocumentRef(entity, id)
  await ref.delete()
  await writeAuditLog({
    action: 'entity.delete',
    actor,
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entity.key,
  })

  return { success: true, id }
}

export async function bulkEntityAction(
  entity: AdminEntityConfig,
  input: Record<string, unknown>,
  actor: AdminSessionUser,
) {
  assertCanWriteEntity(actor, entity)
  assertWritable(entity)

  const ids = readStringArray(input.ids)
    .map(id => id.trim())
    .filter(Boolean)
    .slice(0, 200)
  const action = typeof input.action === 'string' ? input.action : ''
  const actionId = typeof input.actionId === 'string' ? input.actionId : ''

  if (ids.length === 0) {
    throw new HttpError('Select at least one record.', 400)
  }

  if (action === 'delete') {
    assertConfiguredBulkAction(entity, actionId, action)
    await Promise.all(ids.map(id => getDocumentRef(entity, id).delete()))
    await writeAuditLog({
      action: 'entity.bulk_delete',
      actor,
      metadata: {
        count: ids.length,
        ids,
      },
      resourcePath: entity.collection,
      resourceType: entity.key,
    })

    return { action, count: ids.length, success: true }
  }

  if (action !== 'setField') {
    throw new HttpError('Unsupported bulk action.', 400)
  }

  const fieldKey = typeof input.field === 'string' ? input.field : ''
  const configuredAction = assertConfiguredBulkAction(entity, actionId, action, fieldKey)
  const field = entity.fields[fieldKey as keyof typeof entity.fields]

  if (!field || isReservedWriteField(fieldKey)) {
    throw new HttpError('Unsupported bulk field.', 400)
  }

  const rawValue =
    configuredAction && 'value' in configuredAction
      ? configuredAction.value
      : input.value
  const value = parseFieldValue(rawValue, field, fieldKey)
  await Promise.all(
    ids.map(id =>
      getDocumentRef(entity, id).set(
        {
          [fieldKey]: value,
          ...buildUpdateAuditFields(entity),
        },
        { merge: true },
      ),
    ),
  )
  await writeAuditLog({
    action: 'entity.bulk_update',
    actor,
    metadata: {
      count: ids.length,
      field: fieldKey,
      ids,
      value,
    },
    resourcePath: entity.collection,
    resourceType: entity.key,
  })

  return { action, count: ids.length, success: true }
}

export async function runEntityWorkflowAction(
  entity: AdminEntityConfig,
  id: string,
  input: Record<string, unknown>,
  actor: AdminSessionUser,
) {
  const workflowId = typeof input.workflowId === 'string' ? input.workflowId : ''
  const actionId = typeof input.actionId === 'string' ? input.actionId : ''
  const { action, workflow } = assertConfiguredWorkflowAction(
    entity,
    workflowId,
    actionId,
  )

  if (action.type === 'server') {
    return runConfiguredServerWorkflowAction(entity, id, action, workflow.id, actor)
  }

  assertCanWriteEntity(actor, entity)
  assertWritable(entity)

  const ref = getDocumentRef(entity, id)

  if (action.type === 'bulk' && action.operation === 'delete') {
    await ref.delete()
    await writeAuditLog({
      action: 'entity.workflow_delete',
      actor,
      metadata: {
        actionId: action.id,
        workflowId: workflow.id,
      },
      resourceId: id,
      resourcePath: ref.path,
      resourceType: entity.key,
    })

    return {
      action: action.id,
      deleted: true,
      id,
      success: true,
      workflow: workflow.id,
    }
  }

  if (action.type !== 'setField' || !action.field) {
    throw new HttpError('Unsupported workflow action.', 400)
  }

  const field = entity.fields[action.field as keyof typeof entity.fields]

  if (!field || isReservedWriteField(action.field)) {
    throw new HttpError('Unsupported workflow field.', 400)
  }

  const value = parseFieldValue(action.value, field, action.field)
  await ref.set(
    {
      [action.field]: value,
      ...buildUpdateAuditFields(entity),
    },
    { merge: true },
  )
  await writeAuditLog({
    action: 'entity.workflow_update',
    actor,
    metadata: {
      actionId: action.id,
      field: action.field,
      value,
      workflowId: workflow.id,
    },
    resourceId: id,
    resourcePath: ref.path,
    resourceType: entity.key,
  })

  return {
    action: action.id,
    field: action.field,
    id,
    success: true,
    value,
    workflow: workflow.id,
  }
}

function assertConfiguredBulkAction(
  entity: AdminEntityConfig,
  actionId: string,
  apiAction: string,
  fieldKey = '',
): AdminActionConfig | null {
  if (!actionId) {
    throw new HttpError('Bulk action id is required.', 400)
  }

  const action = adminPanelConfig.actions.find(candidate => {
    return (
      candidate.id === actionId &&
      (candidate.entity === entity.key || candidate.entity === entity.route)
    )
  })

  if (!action) {
    throw new HttpError('Unsupported bulk action.', 400)
  }

  if (apiAction === 'delete') {
    if (action.type !== 'bulk' || action.operation !== 'delete') {
      throw new HttpError('Unsupported bulk action.', 400)
    }

    return action
  }

  if (apiAction === 'setField') {
    if (action.type !== 'setField' || action.field !== fieldKey) {
      throw new HttpError('Unsupported bulk action.', 400)
    }

    return action
  }

  throw new HttpError('Unsupported bulk action.', 400)
}

function assertConfiguredWorkflowAction(
  entity: AdminEntityConfig,
  workflowId: string,
  actionId: string,
) {
  if (!workflowId || !actionId) {
    throw new HttpError('Workflow id and action id are required.', 400)
  }

  const workflow = adminPanelConfig.workflows.find(candidate => {
    return (
      candidate.id === workflowId &&
      (candidate.entity === entity.key || candidate.entity === entity.route)
    )
  })

  if (!workflow || !workflow.actions.includes(actionId)) {
    throw new HttpError('Unsupported workflow action.', 400)
  }

  const action = adminPanelConfig.actions.find(candidate => {
    return (
      candidate.id === actionId &&
      (candidate.entity === entity.key || candidate.entity === entity.route)
    )
  })

  if (!action) {
    throw new HttpError('Unsupported workflow action.', 400)
  }

  if (action.type === 'setField') {
    return { action, workflow }
  }

  if (action.type === 'bulk' && action.operation === 'delete') {
    return { action, workflow }
  }

  if (action.type === 'server' && action.serverAction) {
    return { action, workflow }
  }

  throw new HttpError('Unsupported workflow action.', 400)
}

async function runConfiguredServerWorkflowAction(
  entity: AdminEntityConfig,
  id: string,
  action: AdminActionConfig,
  workflowId: string,
  actor: AdminSessionUser,
) {
  if (!action.serverAction) {
    throw new HttpError('Unsupported server workflow action.', 400)
  }

  assertAdminPermission(actor, serverActionPermission(action.serverAction))

  let result: unknown

  if (action.serverAction === 'commerce.orderStatus') {
    assertEntityRoute(entity, ['orders'], 'Commerce order workflow')
    result = await updateCommerceOrderStatus(id, readWorkflowActionValue(action), actor)
  } else if (action.serverAction === 'commerce.driverAvailability') {
    assertEntityRoute(entity, ['users'], 'Commerce driver workflow')
    result = await updateCommerceDriverAvailability(id, readWorkflowBooleanValue(action), actor)
  } else if (action.serverAction === 'appointments.bookingStatus') {
    assertEntityRoute(entity, ['bookings'], 'Appointment booking workflow')
    result = await updateAppointmentBookingStatus(id, readWorkflowActionValue(action), actor)
  } else if (action.serverAction === 'taxi.tripStatus') {
    assertEntityRoute(entity, ['trips'], 'Taxi trip workflow')
    result = await updateTaxiTripStatus(id, readWorkflowActionValue(action), actor)
  } else if (action.serverAction === 'taxi.clearStuckState') {
    assertEntityRoute(entity, ['trips'], 'Taxi trip workflow')
    result = await clearTaxiTripStuckState(id, actor)
  } else if (action.serverAction === 'taxi.driverAvailability') {
    assertEntityRoute(entity, ['users'], 'Taxi driver workflow')
    result = await updateTaxiDriverAvailability(id, readWorkflowBooleanValue(action), actor)
  } else if (action.serverAction === 'support.userAction') {
    assertEntityRoute(entity, ['users'], 'Support workflow')
    result = await applySupportUserAction(
      id,
      readWorkflowActionValue(action) as Parameters<typeof applySupportUserAction>[1],
      actor,
    )
  } else if (action.serverAction === 'socialModeration.action') {
    result = await applySocialModerationAction(
      action.resource ?? entity.route,
      id,
      readWorkflowActionValue(action) as SocialModerationAction,
      actor,
    )
  } else if (action.serverAction === 'listing.action') {
    assertEntityRoute(entity, ['listings'], 'Listing workflow')
    result = await runListingOperationAction(id, readWorkflowActionValue(action), actor)
  } else if (action.serverAction === 'datingSafety.action') {
    result = await runDatingSafetyAction(
      action.resource ?? entity.route,
      id,
      readWorkflowActionValue(action),
      actor,
    )
  } else if (action.serverAction === 'messaging.action') {
    result = await runMessagingOperationAction(
      action.resource ?? entity.route,
      id,
      readWorkflowActionValue(action),
      actor,
    )
  } else {
    throw new HttpError('Unsupported server workflow action.', 400)
  }

  return {
    action: action.id,
    result,
    serverAction: action.serverAction,
    success: true,
    workflow: workflowId,
  }
}

function readWorkflowActionValue(action: AdminActionConfig) {
  if (typeof action.value !== 'string' || action.value.trim().length === 0) {
    throw new HttpError('Workflow action value is required.', 400)
  }

  return action.value.trim()
}

function readWorkflowBooleanValue(action: AdminActionConfig) {
  if (typeof action.value !== 'boolean') {
    throw new HttpError('Workflow action value must be a boolean.', 400)
  }

  return action.value
}

function assertEntityRoute(
  entity: AdminEntityConfig,
  routes: string[],
  label: string,
) {
  if (!routes.includes(entity.key) && !routes.includes(entity.route)) {
    throw new HttpError(`${label} is not available for this resource.`, 400)
  }
}

export async function exportEntitiesCsv(
  entity: AdminEntityConfig,
  searchParams: URLSearchParams,
  actor: AdminSessionUser,
) {
  assertCanReadEntity(actor, entity)

  const db = getFirebaseAdminFirestore()
  const limit = clampExportLimit(searchParams.get('limit'))
  const fields = getExportFields(entity)
  let docs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[] = []

  if (hasCollectionGroups(entity)) {
    const snapshots = await Promise.all(
      entity.collectionGroups.map(collectionGroup =>
        db.collectionGroup(collectionGroup).limit(limit).get(),
      ),
    )
    docs = snapshots.flatMap(snapshot => snapshot.docs).slice(0, limit)
  } else {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
      db.collection(entity.collection)

    if (entity.orderBy) {
      query = query.orderBy(entity.orderBy.field, entity.orderBy.direction)
    }

    docs = (await query.limit(limit).get()).docs
  }

  const rows = docs.map(doc => serializeDocument(doc, hasCollectionGroups(entity)))
  await writeAuditLog({
    action: 'entity.export_csv',
    actor,
    metadata: {
      exportedRows: rows.length,
      fields,
      limit,
    },
    resourcePath: entity.collection,
    resourceType: entity.key,
  })

  return {
    csv: toCsv(fields, rows),
    filename: `${entity.route}-${new Date().toISOString().slice(0, 10)}.csv`,
    rowCount: rows.length,
  }
}

export async function importEntitiesCsv(
  entity: AdminEntityConfig,
  csv: string,
  actor: AdminSessionUser,
) {
  assertCanWriteEntity(actor, entity)
  assertWritable(entity)

  if (hasCollectionGroups(entity)) {
    throw new HttpError('Collection group entities cannot be imported from CSV.', 405)
  }

  const rows = parseCsv(csv)

  if (rows.length < 2) {
    throw new HttpError('CSV must include a header row and at least one data row.', 400)
  }

  const headers = rows[0].map(header => header.trim())

  if (!headers.some(Boolean)) {
    throw new HttpError('CSV header row is empty.', 400)
  }

  const dataRows = rows
    .slice(1)
    .filter(row => row.some(cell => cell.trim().length > 0))
    .slice(0, 500)

  if (dataRows.length === 0) {
    throw new HttpError('CSV does not contain importable rows.', 400)
  }

  const db = getFirebaseAdminFirestore()
  const refs = dataRows.map(row => {
    const rawId = readCsvValue(row, headers, 'id')
    return rawId
      ? db.collection(entity.collection).doc(rawId)
      : db.collection(entity.collection).doc()
  })
  const existingDocs = await db.getAll(...refs)
  const batch = db.batch()
  let created = 0
  let updated = 0
  let skipped = 0
  const errors: Array<{ row: number; message: string }> = []

  dataRows.forEach((row, index) => {
    try {
      const ref = refs[index]
      const existingDoc = existingDocs[index]
      const rawData = rowToWriteData(entity, headers, row)

      if (Object.keys(rawData).length === 0) {
        skipped += 1
        return
      }

      const document = sanitizeWriteData(rawData)

      batch.set(
        ref,
        {
          ...document,
          id: ref.id,
          ...(existingDoc.exists
            ? buildUpdateAuditFields(entity)
            : buildCreateAuditFields(entity)),
        },
        { merge: true },
      )

      if (existingDoc.exists) {
        updated += 1
      } else {
        created += 1
      }
    } catch (error) {
      skipped += 1
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : 'Invalid row.',
      })
    }
  })

  if (created + updated > 0) {
    await batch.commit()
  }

  await writeAuditLog({
    action: 'entity.import_csv',
    actor,
    metadata: {
      created,
      fields: headers,
      skipped,
      updated,
    },
    resourcePath: entity.collection,
    resourceType: entity.key,
  })

  return {
    created,
    errors: errors.slice(0, 20),
    skipped,
    success: true,
    updated,
  }
}

function buildCreateAuditFields(entity: AdminEntityConfig) {
  return {
    createdAt: nowForAuditField(entity, 'createdAt'),
    updatedAt: nowForAuditField(entity, 'updatedAt'),
  }
}

function buildUpdateAuditFields(entity: AdminEntityConfig) {
  return {
    updatedAt: nowForAuditField(entity, 'updatedAt'),
  }
}

function nowForAuditField(entity: AdminEntityConfig, fieldKey: string) {
  const field = entity.fields[fieldKey as keyof typeof entity.fields]

  if (field?.type === 'number') {
    return Math.floor(Date.now() / 1000)
  }

  return FieldValue.serverTimestamp()
}

function rowToWriteData(entity: AdminEntityConfig, headers: string[], row: string[]) {
  const data: Record<string, unknown> = {}

  headers.forEach((fieldKey, index) => {
    const trimmedKey = fieldKey.trim()
    const field = entity.fields[trimmedKey as keyof typeof entity.fields]

    if (!field || isReservedWriteField(trimmedKey)) {
      return
    }

    const rawValue = row[index] ?? ''

    if (rawValue.trim() === '') {
      return
    }

    data[trimmedKey] = parseFieldValue(rawValue, field, trimmedKey)
  })

  const rawId = readCsvValue(row, headers, 'id')
  if (rawId) {
    data.id = rawId
  }

  return data
}

function parseFieldValue(
  value: unknown,
  field: AdminEntityConfig['fields'][string],
  fieldKey: string,
): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()

  if (trimmed === '') {
    return ''
  }

  if (field.type === 'number') {
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      throw new HttpError(`${field.label} must be a number.`, 400)
    }
    return parsed
  }

  if (field.type === 'boolean') {
    if (['true', '1', 'yes', 'y'].includes(trimmed.toLowerCase())) {
      return true
    }
    if (['false', '0', 'no', 'n'].includes(trimmed.toLowerCase())) {
      return false
    }
    throw new HttpError(`${field.label} must be true or false.`, 400)
  }

  if (field.type === 'date') {
    const date = new Date(trimmed)
    if (Number.isNaN(date.getTime())) {
      throw new HttpError(`${field.label} must be a valid date.`, 400)
    }
    return date.toISOString()
  }

  if (field.type === 'enum') {
    const options = Array.isArray(field.options) ? field.options : []
    if (options.length > 0 && !options.includes(trimmed)) {
      throw new HttpError(`${field.label} must be one of: ${options.join(', ')}.`, 400)
    }
    return trimmed
  }

  if (field.type === 'array' || field.type === 'foreignKeys' || field.type === 'photos') {
    return parseArrayValue(trimmed)
  }

  if (field.type === 'object' || field.type === 'location') {
    return parseJsonValue(trimmed, field.label)
  }

  if (fieldKey === 'createdAt' || fieldKey === 'updatedAt') {
    return trimmed
  }

  return trimmed
}

function parseArrayValue(value: string) {
  if (value.startsWith('[')) {
    const parsed = parseJsonValue(value, 'Array field')
    if (!Array.isArray(parsed)) {
      throw new HttpError('Array field must be a JSON array.', 400)
    }
    return parsed
  }

  return value
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
}

function parseJsonValue(value: string, label: string) {
  try {
    return JSON.parse(value)
  } catch {
    throw new HttpError(`${label} must be valid JSON.`, 400)
  }
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function isReservedWriteField(fieldKey: string) {
  return (
    fieldKey === '_id' ||
    fieldKey === '_path' ||
    fieldKey === 'createdAt' ||
    fieldKey === 'updatedAt'
  )
}

function parseCsv(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let isInQuotes = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const nextChar = csv[index + 1]

    if (isInQuotes) {
      if (char === '"' && nextChar === '"') {
        cell += '"'
        index += 1
        continue
      }

      if (char === '"') {
        isInQuotes = false
        continue
      }

      cell += char
      continue
    }

    if (char === '"') {
      isInQuotes = true
      continue
    }

    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }

    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    if (char !== '\r') {
      cell += char
    }
  }

  row.push(cell)
  rows.push(row)

  return rows
}

function readCsvValue(row: string[], headers: string[], key: string) {
  const index = headers.findIndex(header => header.trim() === key)
  const value = index >= 0 ? row[index]?.trim() : ''
  return value || null
}

function clampExportLimit(rawLimit: string | null) {
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : 500

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 500
  }

  return Math.min(parsed, 1000)
}

function getExportFields(entity: AdminEntityConfig) {
  return Array.from(new Set(['id', entity.titleField, ...entity.listFields])).filter(
    field => field && field !== '_path',
  )
}

function toCsv(fields: string[], rows: Array<Record<string, unknown>>) {
  const lines = [
    fields.map(csvCell).join(','),
    ...rows.map(row => fields.map(field => csvCell(formatCsvValue(row[field]))).join(',')),
  ]

  return `${lines.join('\n')}\n`
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value)
}

function csvCell(value: unknown) {
  return `"${String(value).replace(/"/g, '""')}"`
}
