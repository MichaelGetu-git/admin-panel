import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import type { AdminSessionUser } from './auth'
import { getFirebaseAdminFirestore } from './firebase-admin'

const auditCollection = 'admin_audit_logs'
const defaultLimit = 50
const maxLimit = 200

export interface AuditLogInput {
  action: string
  actor: AdminSessionUser
  metadata?: Record<string, unknown>
  resourceId?: string
  resourcePath?: string
  resourceType: string
}

export interface AuditLogEntry {
  action: string
  actorEmail: string
  actorRole: string
  actorUid: string
  createdAt?: string
  id: string
  metadata: Record<string, unknown>
  resourceId: string
  resourcePath: string
  resourceType: string
}

export async function writeAuditLog(input: AuditLogInput) {
  await getFirebaseAdminFirestore().collection(auditCollection).add({
    action: input.action,
    actorEmail: input.actor.email ?? '',
    actorRole: input.actor.role,
    actorUid: input.actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    metadata: sanitizeMetadata(input.metadata ?? {}),
    resourceId: input.resourceId ?? '',
    resourcePath: input.resourcePath ?? '',
    resourceType: input.resourceType,
  })
}

export async function listAuditLogs(searchParams: URLSearchParams) {
  const limit = clampLimit(searchParams.get('limit'))
  const snapshot = await getFirebaseAdminFirestore()
    .collection(auditCollection)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  return {
    items: snapshot.docs.map(doc => serializeAuditLog(doc)),
    nextCursor: snapshot.docs.at(-1)?.id ?? null,
  }
}

function serializeAuditLog(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): AuditLogEntry {
  const data = doc.data()

  return {
    action: readString(data.action),
    actorEmail: readString(data.actorEmail),
    actorRole: readString(data.actorRole),
    actorUid: readString(data.actorUid),
    createdAt: parseDate(data.createdAt),
    id: doc.id,
    metadata: isObjectRecord(data.metadata) ? data.metadata : {},
    resourceId: readString(data.resourceId),
    resourcePath: readString(data.resourcePath),
    resourceType: readString(data.resourceType),
  }
}

function clampLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultLimit
  }

  return Math.min(parsed, maxLimit)
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, sanitizeMetadataValue(value)]),
  )
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeMetadataValue)
  }

  if (isObjectRecord(value)) {
    return sanitizeMetadata(value)
  }

  return value
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function parseDate(value: unknown) {
  if (!value) {
    return undefined
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    return date?.toISOString()
  }

  return typeof value === 'string' ? value : undefined
}
