import 'server-only'

import type { AdminEntityConfig } from '@/generated/admin-panel.config'
import { getFirebaseAdminFirestore } from './firebase-admin'
import { HttpError } from './http'

const maxPageSize = 100

export async function searchEntities(
  db: FirebaseFirestore.Firestore,
  entity: AdminEntityConfig,
  searchTerm: string,
  limit: number,
) {
  const searchFields = getSearchFields(entity)
  if (searchFields.length === 0) {
    return null
  }

  const snapshots = await Promise.all(
    searchFields.map(field =>
      db
        .collection(entity.collection)
        .orderBy(field)
        .startAt(searchTerm)
        .endAt(searchTerm + '\uf8ff')
        .limit(limit)
        .get()
        .catch(() => null),
    ),
  )
  const docsById = new Map<
    string,
    FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
  >()

  for (const snapshot of snapshots) {
    for (const doc of snapshot?.docs ?? []) {
      docsById.set(doc.id, doc)
    }
  }

  return {
    items: Array.from(docsById.values())
      .map(doc => serializeDocument(doc))
      .slice(0, limit),
    nextCursor: null,
  }
}

function getSearchFields(entity: AdminEntityConfig) {
  const candidates = [
    entity.titleField,
    ...entity.typeaheadFields,
    ...entity.listFields,
  ]

  return Array.from(new Set(candidates))
    .filter(fieldKey => {
      const field = entity.fields[fieldKey as keyof typeof entity.fields]
      return field?.type === 'string' || field?.type === 'enum'
    })
    .slice(0, 4)
}

export function getDocumentRef(entity: AdminEntityConfig, id: string) {
  const db = getFirebaseAdminFirestore()
  const decodedId = safeDecodeURIComponent(id)

  if (hasCollectionGroups(entity)) {
    if (!decodedId.includes('/')) {
      throw new HttpError('Collection group document path is required.', 400)
    }

    return db.doc(decodedId)
  }

  return db.collection(entity.collection).doc(decodedId)
}

export function hasCollectionGroups(entity: AdminEntityConfig) {
  return entity.collectionGroups.length > 0
}

export function assertWritable(entity: AdminEntityConfig) {
  if (entity.access === 'readOnly') {
    throw new HttpError('Entity is read-only.', 405)
  }
}

export function clampLimit(rawLimit: string | null) {
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : 25
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 25
  }
  return Math.min(parsed, maxPageSize)
}

export function sanitizeWriteData(data: Record<string, unknown>) {
  const copy = { ...data }
  delete copy.id
  delete copy._id
  delete copy._path
  delete copy.createdAt
  delete copy.updatedAt
  return copy
}

export function serializeDocument(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  usePathId = false,
) {
  const data = serializeValue(doc.data() ?? {}) as Record<string, unknown>

  if (usePathId) {
    return {
      ...data,
      _id: doc.id,
      _path: doc.ref.path,
      id: doc.ref.path,
    }
  }

  return {
    id: doc.id,
    ...data,
  }
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function serializeValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => serializeValue(item))
  }

  if ('toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serializeValue(item)]),
  )
}
