import 'server-only'

import { cookies } from 'next/headers'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from './firebase-admin'

const sessionCookieName = process.env.ADMIN_SESSION_COOKIE_NAME ?? 'admin_session'
const sessionExpiresIn = Number(process.env.ADMIN_SESSION_EXPIRES_IN_MS ?? 432000000)
const allowIdTokenSmokeSession =
  process.env.ADMIN_ALLOW_ID_TOKEN_SESSION_FOR_SMOKE === '1'
export const adminRoleOptions = [
  'owner',
  'operator',
  'support',
  'moderator',
  'content_manager',
] as const

export type AdminRole = (typeof adminRoleOptions)[number]

export class AuthError extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export interface AdminSessionUser {
  uid: string
  email?: string
  role: AdminRole
}

export async function createAdminSession(idToken: string): Promise<AdminSessionUser> {
  const auth = getFirebaseAdminAuth()
  const decodedToken = await auth.verifyIdToken(idToken)
  const role = await resolveAdminRole(decodedToken)

  const sessionCookie = allowIdTokenSmokeSession
    ? idToken
    : await auth.createSessionCookie(idToken, {
        expiresIn: sessionExpiresIn,
      })

  const cookieStore = await cookies()
  cookieStore.set(sessionCookieName, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.floor(sessionExpiresIn / 1000),
    path: '/',
  })

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    role,
  }
}

export async function requireAdminUser(): Promise<AdminSessionUser> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(sessionCookieName)?.value

  if (!sessionCookie) {
    throw new AuthError('Authentication required.', 401)
  }

  const auth = getFirebaseAdminAuth()
  const decodedToken = allowIdTokenSmokeSession
    ? await auth.verifyIdToken(sessionCookie)
    : await auth.verifySessionCookie(sessionCookie, true)
  const role = await resolveAdminRole(decodedToken)

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    role,
  }
}

export async function requireAdminRole(
  allowedRoles: AdminRole[],
): Promise<AdminSessionUser> {
  const user = await requireAdminUser()

  if (!allowedRoles.includes(user.role)) {
    throw new AuthError('Insufficient admin role.', 403)
  }

  return user
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  cookieStore.delete(sessionCookieName)
}

async function resolveAdminRole(decodedToken: DecodedIdToken): Promise<AdminRole> {
  const tokenRole = readAdminRole(decodedToken.adminRole ?? decodedToken.role)

  if (decodedToken.admin === true || decodedToken.isAdmin === true) {
    return tokenRole ?? 'operator'
  }

  const userDoc = await getFirebaseAdminFirestore()
    .collection('users')
    .doc(decodedToken.uid)
    .get()
  const user = userDoc.data()
  const userRole = readAdminRole(user?.adminRole ?? user?.role)

  if (userRole) {
    return userRole
  }

  if (user?.role === 'admin' || user?.admin === true || user?.isAdmin === true) {
    return 'operator'
  }

  throw new AuthError('Admin access required.', 403)
}

function readAdminRole(value: unknown): AdminRole | null {
  return adminRoleOptions.includes(value as AdminRole) ? (value as AdminRole) : null
}
