'use client'

import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getApps, initializeApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function getFirebaseApp() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(`Missing Firebase public config: ${missing.join(', ')}`)
  }

  return getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
}

export function getFirebaseAuthClient() {
  return getAuth(getFirebaseApp())
}

export function getFirebaseFirestoreClient() {
  return getFirestore(getFirebaseApp())
}
