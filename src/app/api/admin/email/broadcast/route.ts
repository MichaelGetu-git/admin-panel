import { NextResponse } from 'next/server'
import { getFirebaseAdminFirestore } from '@/lib/server/firebase-admin'
import { writeAuditLog } from '@/lib/server/audit-log'
import { HttpError, jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission('email.write')
    const body = await readJsonObject(request)
    const from = readRequiredString(body.from, 'From')
    const subject = readRequiredString(body.subject, 'Subject')
    const type = body.type === 'html' ? 'html' : 'text'
    const content = type === 'html'
      ? readRequiredString(body.html, 'HTML body')
      : readRequiredString(body.text, 'Text body')

    if (!isEmail(from)) {
      throw new HttpError('From must be a valid email address.', 400)
    }

    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) {
      throw new HttpError('SENDGRID_API_KEY is not configured.', 501)
    }

    const db = getFirebaseAdminFirestore()
    const limit = readPositiveEnvInt('EMAIL_BROADCAST_LIMIT', 500, 1000)
    const snapshot = await db.collection('users').orderBy('email').limit(limit).get()
    const recipients = Array.from(
      new Set(
        snapshot.docs
          .map(doc => doc.data().email)
          .filter((email): email is string => typeof email === 'string' && isEmail(email)),
      ),
    )

    if (recipients.length === 0) {
      await writeAuditLog({
        action: 'campaign.email_broadcast',
        actor: admin,
        metadata: {
          contentType: type,
          recipientsCount: 0,
          subject,
        },
        resourceType: 'campaign',
      })
      return NextResponse.json({ success: true, recipients: 0 })
    }

    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: recipients.map(email => ({ email })),
          },
        ],
        from: { email: from },
        subject,
        content: [
          {
            type: type === 'html' ? 'text/html' : 'text/plain',
            value: content,
          },
        ],
      }),
    })

    if (!sendGridResponse.ok) {
      const details = await sendGridResponse.text().catch(() => '')
      throw new HttpError(
        'SendGrid rejected the broadcast' + (details ? ': ' + details.slice(0, 160) : '.'),
        502,
      )
    }

    await db.collection('sent_emails').add({
      contentType: type,
      createdAt: new Date().toISOString(),
      createdBy: admin.email ?? admin.uid,
      from,
      recipientsCount: recipients.length,
      subject,
    })
    await writeAuditLog({
      action: 'campaign.email_broadcast',
      actor: admin,
      metadata: {
        contentType: type,
        recipientsCount: recipients.length,
        subject,
      },
      resourceType: 'campaign',
    })

    return NextResponse.json({ success: true, recipients: recipients.length })
  } catch (error) {
    return jsonError(error)
  }
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(label + ' is required.', 400)
  }

  return value.trim()
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function readPositiveEnvInt(name: string, fallback: number, max: number) {
  const value = Number.parseInt(process.env[name] ?? '', 10)

  if (!Number.isFinite(value) || value < 1) {
    return fallback
  }

  return Math.min(value, max)
}
