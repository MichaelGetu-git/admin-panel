import { NextResponse } from 'next/server'
import {
  getFirebaseAdminFirestore,
  getFirebaseAdminMessaging,
} from '@/lib/server/firebase-admin'
import { writeAuditLog } from '@/lib/server/audit-log'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission('notifications.write')
    const body = await readJsonObject(request)
    const title = readRequiredString(body.title, 'Title')
    const message = readRequiredString(body.message, 'Message')
    const icon = typeof body.icon === 'string' ? body.icon.trim() : ''

    const db = getFirebaseAdminFirestore()
    const limit = readPositiveEnvInt('PUSH_BROADCAST_LIMIT', 500, 500)
    const snapshot = await db.collection('users').orderBy('pushToken').limit(limit).get()
    const tokens = Array.from(
      new Set(
        snapshot.docs
          .map(doc => doc.data().pushToken)
          .filter((token): token is string => typeof token === 'string' && token.length > 0),
      ),
    )

    if (tokens.length === 0) {
      await logNotification(db, admin.email ?? admin.uid, title, message, icon, 0, 0)
      await writeAuditLog({
        action: 'campaign.push_broadcast',
        actor: admin,
        metadata: {
          failureCount: 0,
          recipientsCount: 0,
          title,
        },
        resourceType: 'campaign',
      })
      return NextResponse.json({ success: true, development: true, recipients: 0 })
    }

    const response = await getFirebaseAdminMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title,
        body: message,
        imageUrl: icon || undefined,
      },
      data: {
        icon,
        message,
        title,
      },
    })

    await logNotification(
      db,
      admin.email ?? admin.uid,
      title,
      message,
      icon,
      response.successCount,
      response.failureCount,
    )
    await writeAuditLog({
      action: 'campaign.push_broadcast',
      actor: admin,
      metadata: {
        failureCount: response.failureCount,
        recipientsCount: response.successCount,
        title,
      },
      resourceType: 'campaign',
    })

    return NextResponse.json({
      success: true,
      failures: response.failureCount,
      recipients: response.successCount,
    })
  } catch (error) {
    return jsonError(error)
  }
}

async function logNotification(
  db: FirebaseFirestore.Firestore,
  createdBy: string,
  title: string,
  message: string,
  icon: string,
  successCount: number,
  failureCount: number,
) {
  await db.collection('push_notifications').add({
    createdAt: new Date().toISOString(),
    createdBy,
    failureCount,
    icon,
    message,
    successCount,
    title,
  })
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(label + ' is required.', 400)
  }

  return value.trim()
}

function readPositiveEnvInt(name: string, fallback: number, max: number) {
  const value = Number.parseInt(process.env[name] ?? '', 10)

  if (!Number.isFinite(value) || value < 1) {
    return fallback
  }

  return Math.min(value, max)
}
