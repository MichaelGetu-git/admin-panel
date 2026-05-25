import { NextResponse } from 'next/server'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { requireAdminUser } from '@/lib/server/auth'
import { getFirebaseAdminFirestore } from '@/lib/server/firebase-admin'
import { jsonError } from '@/lib/server/http'
import { assertCanReadEntity } from '@/lib/server/permissions'

const entity = getEntityConfig("channels")
const maxPageSize = 100
const messageCollectionCandidates = ['messages', 'messages_live', 'thread', 'messages_historical']

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const adminUser = await requireAdminUser()
    assertCanReadEntity(adminUser, entity)
    const { id } = await params
    const searchParams = new URL(request.url).searchParams
    const limit = clampLimit(searchParams.get('limit'))
    const direction: FirebaseFirestore.OrderByDirection =
      searchParams.get('direction') === 'asc' ? 'asc' : 'desc'
    const orderBy = searchParams.get('orderBy') === 'updatedAt' ? 'updatedAt' : 'createdAt'
    const cursor = searchParams.get('cursor')
    const collectionName =
      searchParams.get('collectionName') ?? searchParams.get('collection') ?? ''
    const channelRef = getFirebaseAdminFirestore()
      .collection(entity.collection)
      .doc(id)
    const candidates = collectionName ? [collectionName] : messageCollectionCandidates

    for (const candidate of candidates) {
      const result = await readMessagePage(
        channelRef.collection(candidate),
        orderBy,
        direction,
        limit,
        cursor,
      )

      if (result.items.length > 0 || collectionName) {
        return NextResponse.json({
          channelId: id,
          collectionName: candidate,
          entity: entity.key,
          items: result.items,
          messages: result.items,
          nextCursor: result.nextCursor,
        })
      }
    }

    return NextResponse.json({
      channelId: id,
      collectionName: null,
      entity: entity.key,
      items: [],
      messages: [],
      nextCursor: null,
    })
  } catch (error) {
    return jsonError(error)
  }
}

async function readMessagePage(
  collection: FirebaseFirestore.CollectionReference,
  orderBy: string,
  direction: FirebaseFirestore.OrderByDirection,
  limit: number,
  cursor: string | null,
) {
  let query = collection.orderBy(orderBy, direction).limit(limit)

  if (cursor) {
    const cursorDoc = await collection.doc(cursor).get()
    if (cursorDoc.exists) {
      query = collection.orderBy(orderBy, direction).startAfter(cursorDoc).limit(limit)
    }
  }

  const snapshot = await query.get().catch(() => collection.limit(limit).get())
  const last = snapshot.docs.at(-1)

  return {
    items: snapshot.docs.map(doc => serializeDocument(doc)),
    nextCursor: snapshot.docs.length === limit ? last?.id ?? null : null,
  }
}

function clampLimit(rawLimit: string | null) {
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : 50
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 50
  }
  return Math.min(parsed, maxPageSize)
}

function serializeDocument(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = serializeValue(doc.data()) as Record<string, unknown>

  return {
    id: doc.id,
    ...data,
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
