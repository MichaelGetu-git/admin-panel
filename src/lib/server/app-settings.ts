import 'server-only'

import { FieldValue } from 'firebase-admin/firestore'
import { adminPanelConfig } from '@/generated/admin-panel.config'
import { getFirebaseAdminFirestore } from './firebase-admin'

const settingsCollection = 'admin_config'
const settingsDocument = 'app'

export interface AdminAppSettings {
  [key: string]: string | undefined
  updatedAt?: string
  updatedBy?: string
}

const writableFields = adminPanelConfig.settings.map(field => field.key)
const defaultSettings = Object.fromEntries(
  adminPanelConfig.settings.map(field => [field.key, readString(field.defaultValue)]),
) as AdminAppSettings

export async function getAdminAppSettings(): Promise<AdminAppSettings> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection(settingsCollection)
    .doc(settingsDocument)
    .get()

  return normalizeSettings(snapshot.data())
}

export async function updateAdminAppSettings(
  input: Record<string, unknown>,
  updatedBy?: string,
): Promise<AdminAppSettings> {
  const update: Record<string, unknown> = {}

  for (const field of writableFields) {
    update[field] = readString(input[field])
  }

  update.updatedAt = FieldValue.serverTimestamp()
  update.updatedBy = updatedBy ?? ''

  await getFirebaseAdminFirestore()
    .collection(settingsCollection)
    .doc(settingsDocument)
    .set(update, { merge: true })

  return getAdminAppSettings()
}

function normalizeSettings(data: FirebaseFirestore.DocumentData | undefined) {
  const settings = { ...defaultSettings }

  if (!data) {
    return settings
  }

  for (const field of writableFields) {
    settings[field] = readString(data[field])
  }

  settings.updatedAt = parseDate(data.updatedAt)
  settings.updatedBy = readString(data.updatedBy)

  return settings
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseDate(value: unknown) {
  if (!value) {
    return undefined
  }

  if (typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    return date?.toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return typeof value === 'string' ? value : undefined
}
