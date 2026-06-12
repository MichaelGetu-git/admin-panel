'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot } from 'firebase/firestore'
import { getFirebaseFirestoreClient } from '@/lib/client/firebase'
import {
  Bell,
  Building2,
  Grid3x3,
  MapPin,
  Shield,
  SlidersHorizontal,
  Star,
  Users,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalListings: number
  totalUsers: number
  totalReviews: number
}

// ── Tile config (mirrors mobile AdminDashboardScreen tiles array) ─────────────

const tiles = [
  {
    icon: MapPin,
    name: 'Manage Listings',
    desc: 'Edit & delete workshops',
    href: '/admin/listings',
  },
  {
    icon: Users,
    name: 'User Management',
    desc: 'Roles, bans & search',
    href: '/admin/users',
  },
  {
    icon: Bell,
    name: 'Notifications',
    desc: 'Broadcast to all users',
    href: '/admin/sendNotification',
  },
  {
    icon: Star,
    name: 'Review Moderation',
    desc: 'View & moderate reviews',
    href: '/admin/reviews',
  },
  {
    icon: Grid3x3,
    name: 'Categories',
    desc: 'Add, edit & reorder',
    href: '/admin/categories',
  },
  {
    icon: Shield,
    name: 'Abuse Reports',
    desc: 'View & ban reported users',
    href: '/admin/moderation',
  },
  {
    icon: SlidersHorizontal,
    name: 'Filters',
    desc: 'Manage filter options',
    href: '/admin/filters',
  },
]

// ── Component ────────────────────────────────────────────────────────────────

export default function Page() {
  const [stats, setStats] = useState<Stats>({
    totalListings: 0,
    totalUsers: 0,
    totalReviews: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const db = getFirebaseFirestoreClient()
    const unsubs: (() => void)[] = []

    // Real-time listeners — same three collections as the mobile admin
    unsubs.push(
      onSnapshot(collection(db, 'store_locator_listings'), snap => {
        setStats(prev => ({ ...prev, totalListings: snap.size }))
        setLoading(false)
      }),
    )

    unsubs.push(
      onSnapshot(collection(db, 'users'), snap => {
        setStats(prev => ({ ...prev, totalUsers: snap.size }))
      }),
    )

    unsubs.push(
      onSnapshot(collection(db, 'store_locator_reviews'), snap => {
        setStats(prev => ({ ...prev, totalReviews: snap.size }))
      }),
    )

    return () => unsubs.forEach(u => u())
  }, [])

  const avgReviews =
    stats.totalListings > 0 && stats.totalReviews > 0
      ? (stats.totalReviews / stats.totalListings).toFixed(1)
      : '0'

  return (
    <div className="space-y-8 pb-10">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workshops, users and content
        </p>
      </div>

      {/* ── Overview — 4 stat cards ── */}
      <section>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Overview
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Accent card — Total Listings */}
          <div className="flex flex-col rounded-2xl border bg-primary p-5">
            <MapPin className="mb-3 h-5 w-5 text-primary-foreground/80" />
            <span className="text-3xl font-extrabold leading-none text-primary-foreground">
              {loading ? '—' : stats.totalListings}
            </span>
            <span className="mt-1.5 text-xs text-primary-foreground/70">Total Listings</span>
          </div>

          {/* Total Users */}
          <div className="flex flex-col rounded-2xl border bg-card p-5">
            <Users className="mb-3 h-5 w-5 text-muted-foreground" />
            <span className="text-3xl font-extrabold leading-none">
              {loading ? '—' : stats.totalUsers}
            </span>
            <span className="mt-1.5 text-xs text-muted-foreground">Total Users</span>
          </div>

          {/* Total Reviews */}
          <div className="flex flex-col rounded-2xl border bg-card p-5">
            <Star className="mb-3 h-5 w-5 text-muted-foreground" />
            <span className="text-3xl font-extrabold leading-none">
              {loading ? '—' : stats.totalReviews}
            </span>
            <span className="mt-1.5 text-xs text-muted-foreground">Total Reviews</span>
          </div>

          {/* Avg Reviews/Listing */}
          <div className="flex flex-col rounded-2xl border bg-card p-5">
            <Building2 className="mb-3 h-5 w-5 text-muted-foreground" />
            <span className="text-3xl font-extrabold leading-none">
              {loading ? '—' : avgReviews}
            </span>
            <span className="mt-1.5 text-xs text-muted-foreground">Avg Reviews/Listing</span>
          </div>
        </div>
      </section>

      {/* ── Manage — 7 action tiles ── */}
      <section>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Manage
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map(tile => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="group flex min-h-[120px] flex-col justify-between rounded-2xl border bg-card p-5 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">{tile.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tile.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Quick Stats row ── */}
      <section>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Quick Stats
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center rounded-2xl border bg-card p-4 text-center">
            <span className="text-xl font-bold">
              {loading ? '—' : stats.totalListings}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">Active Workshops</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl border bg-card p-4 text-center">
            <span className="text-xl font-bold">
              {loading ? '—' : stats.totalUsers}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">Registered Users</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl border bg-card p-4 text-center">
            <span className="text-xl font-bold">
              {loading ? '—' : stats.totalReviews}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">User Reviews</span>
          </div>
        </div>
      </section>
    </div>
  )
}
