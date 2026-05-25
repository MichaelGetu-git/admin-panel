import 'server-only'

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import type { AppOptions, Credential } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { getStorage } from 'firebase-admin/storage'

let firestoreSettingsApplied = false

export function getFirebaseAdminApp() {
  const existingApp = getApps()[0]
  if (existingApp) {
    return existingApp
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const appOptions: AppOptions = {
    credential: getFirebaseAdminCredential(),
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  }

  return initializeApp(appOptions)
}

function getFirebaseAdminCredential(): Credential {
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  if (serviceAccountBase64) {
    try {
      const json = Buffer.from(serviceAccountBase64, 'base64').toString('utf8')
      const config = JSON.parse(json)
      return cert(config)
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', error)
    }
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (serviceAccountPath) {
    return cert(serviceAccountPath)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey })
  }

  return applicationDefault()
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp())
}

export function getFirebaseAdminFirestore() {
  const db = getFirestore(getFirebaseAdminApp())

  if (!firestoreSettingsApplied) {
    try {
      db.settings({ ignoreUndefinedProperties: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('settings() once')) {
        throw error
      }
    }
    firestoreSettingsApplied = true
  }

  return db
}

export function getFirebaseAdminMessaging() {
  return getMessaging(getFirebaseAdminApp())
}

export function getFirebaseAdminStorageBucket() {
  return getStorage(getFirebaseAdminApp()).bucket()
}
