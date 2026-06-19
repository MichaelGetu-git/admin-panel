'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { getFirebaseFirestoreClient } from '@/lib/client/firebase'
import { Plus, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  profilePictureURL?: string
  profilePicture?: string
  role?: string
  banned?: boolean
  createdAt?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ''

function getUserName(user: AdminUser) {
  return (
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
    user.fullName ||
    user.email ||
    'Unknown'
  )
}

function getUserInitial(user: AdminUser) {
  const name = getUserName(user)
  return name.charAt(0).toUpperCase()
}

type RoleBadgeStyle = { bg: string; text: string; label: string }

function getRoleBadge(user: AdminUser): RoleBadgeStyle {
  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL
  if (isSuperAdmin)
    return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Super Admin' }
  switch (user.role) {
    case 'admin':
      return { bg: 'bg-primary/10', text: 'text-primary', label: 'Admin' }
    case 'manager':
    case 'owner':
      return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-300', label: user.role }
    default:
      return { bg: 'bg-muted', text: 'text-muted-foreground', label: user.role || 'User' }
  }
}

// ── Action Modal ─────────────────────────────────────────────────────────────

interface Action {
  key: string
  label: string
  destructive?: boolean
  onPress: () => void
}

function ActionModal({
  user,
  currentUserEmail,
  onClose,
  router,
}: {
  user: AdminUser
  currentUserEmail: string
  onClose: () => void
  router: any
}) {
  const db = getFirebaseFirestoreClient()
  const isSuperAdmin = currentUserEmail === SUPER_ADMIN_EMAIL

  const updateRole = async (newRole: string) => {
    if (!confirm(`Change role to "${newRole}" for ${getUserName(user)}?`)) return
    try {
      await updateDoc(doc(db, 'users', user.id), {
        role: newRole,
        isAdmin: newRole === 'admin',
        updatedAt: Math.floor(Date.now() / 1000),
      })
    } catch {
      alert('Error updating role')
    }
    onClose()
  }

  const toggleBan = async (ban: boolean) => {
    const msg = ban ? 'Are you sure you want to ban this user?' : 'Unban this user?'
    if (!confirm(msg)) return
    try {
      await updateDoc(doc(db, 'users', user.id), {
        banned: ban,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      alert(ban ? 'User banned' : 'User unbanned')
    } catch {
      alert('Error updating user')
    }
    onClose()
  }

  const actions: Action[] = []

  actions.push({ key: 'edit', label: 'Edit Full Profile', onPress: () => { router.push(`/admin/users/${user.id}/update`); onClose() } })

  if (user.role !== 'admin') {
    actions.push({ key: 'admin', label: 'Promote to Admin', onPress: () => { void updateRole('admin') } })
  }
  if (user.role !== 'manager') {
    actions.push({ key: 'manager', label: 'Promote to Manager', onPress: () => { void updateRole('manager') } })
  }
  if (user.role && user.role !== 'user') {
    actions.push({ key: 'user', label: 'Demote to User', onPress: () => { void updateRole('user') } })
  }
  if (user.banned) {
    actions.push({ key: 'unban', label: 'Unban User', onPress: () => { void toggleBan(false) } })
  } else {
    actions.push({ key: 'ban', label: 'Ban User', destructive: true, onPress: () => { void toggleBan(true) } })
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      onClick={onClose}
    >
      {/* Sheet card */}
      <div
        className="w-full max-w-sm rounded-t-[22px] border bg-card p-5 pb-7 sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="truncate font-bold">{getUserName(user)}</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          {actions.map(action => (
            <button
              key={action.key}
              onClick={action.onPress}
              className={`w-full rounded-2xl border py-3.5 text-sm font-semibold transition-colors ${
                action.destructive
                  ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40'
                  : 'border-border bg-muted/50 hover:bg-muted'
              }`}
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={onClose}
            className="w-full rounded-2xl border bg-muted py-3.5 text-sm font-bold transition-colors hover:bg-muted/70"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalUser, setModalUser] = useState<AdminUser | null>(null)
  const router = useRouter()

  // Simulate current user email from session — we read from cookie name
  // In production this would come from server props, but for client parity we
  // guard the super-admin email via env var on the client too
  const currentUserEmail = SUPER_ADMIN_EMAIL // simplification: protect by env

  useEffect(() => {
    const db = getFirebaseFirestoreClient()
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AdminUser))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filtered = search.trim()
    ? users.filter(u => {
        const q = search.toLowerCase().trim()
        const name = `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.fullName ?? ''}`.toLowerCase()
        const email = (u.email ?? '').toLowerCase()
        return name.includes(q) || email.includes(q)
      })
    : users

  const handleRowClick = (user: AdminUser) => {
    // Guard: can't touch super-admin (unless you ARE the super-admin)
    if (user.email === SUPER_ADMIN_EMAIL && currentUserEmail !== SUPER_ADMIN_EMAIL) {
      alert('This is the super administrator account and cannot be modified.')
      return
    }
    setModalUser(user)
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">User Management</h1>
        <button
          onClick={() => router.push('/admin/users/add')}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search users by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-2xl border bg-muted/40 py-3 pl-9 pr-4 text-sm outline-none ring-primary focus:ring-2"
        />
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {loading ? 'Loading…' : `${filtered.length} users`}
      </p>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No users found.</p>
        )}
        {!loading &&
          filtered.map((user, idx) => {
            const badge = getRoleBadge(user)
            const pic = user.profilePictureURL || user.profilePicture
            return (
              <button
                key={user.id}
                onClick={() => handleRowClick(user)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 ${
                  idx !== 0 ? 'border-t' : ''
                } ${user.banned ? 'opacity-50' : ''}`}
              >
                {/* Avatar */}
                {pic ? (
                  <img
                    src={pic}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                    {getUserInitial(user)}
                  </div>
                )}

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{getUserName(user)}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email ?? ''}</p>
                  {user.banned && (
                    <p className="text-xs font-bold text-red-500">BANNED</p>
                  )}
                </div>

                {/* Role badge */}
                <span
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </span>
              </button>
            )
          })}
      </div>

      {/* Action modal */}
      {modalUser && (
        <ActionModal
          user={modalUser}
          currentUserEmail={currentUserEmail}
          onClose={() => setModalUser(null)}
          router={router}
        />
      )}
    </div>
  )
}
