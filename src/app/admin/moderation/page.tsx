'use client'

import { useEffect, useState } from 'react'
import {
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'
import { getFirebaseFirestoreClient } from '@/lib/client/firebase'
import { X } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface AbuseReport {
  id: string
  refPath: string // We need the full path to delete it later
  source?: string
  dest?: string
  type?: string
  createdAt?: number
  user?: {
    id?: string
    firstName?: string
    lastName?: string
    email?: string
  }
}

// ── Action Modal ──────────────────────────────────────────────────────────────

function ActionModal({
  report,
  onBan,
  onDismiss,
  onClose,
}: {
  report: AbuseReport
  onBan: () => void
  onDismiss: () => void
  onClose: () => void
}) {
  const reportedName = `${report.user?.firstName || ''} ${report.user?.lastName || ''}`.trim() 
    || report.user?.email 
    || report.dest 
    || 'User'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-[22px] border bg-card p-5 pb-7 sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="truncate font-bold">Report against {reportedName}</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={onBan}
            className="w-full rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Ban User
          </button>

          <button
            onClick={onDismiss}
            className="w-full rounded-2xl border bg-muted/50 py-3.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Dismiss Report
          </button>

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AbuseReportsPage() {
  const [reports, setReports] = useState<AbuseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<AbuseReport | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    const db = getFirebaseFirestoreClient()
    
    // Use collectionGroup to match mobile behaviour exactly
    const unsub = onSnapshot(collectionGroup(db, 'reports'), snap => {
      const data = snap.docs.map(d => ({
        id: d.id,
        refPath: d.ref.path,
        ...d.data()
      })) as AbuseReport[]

      // Sort client-side by createdAt desc (as collectionGroup orderBy requires composite index)
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      
      setReports(data)
      setLoading(false)
    }, (err) => {
      console.error("Error fetching abuse reports", err)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return ''
    const num = timestamp > 9999999999 ? timestamp : timestamp * 1000
    return new Date(num).toLocaleString()
  }

  const handleBan = async (report: AbuseReport) => {
    const destUserID = report.dest || report.user?.id
    if (!destUserID) {
      alert('Could not find user ID to ban')
      return
    }

    if (!confirm('Are you sure you want to ban this user?')) return

    setSelectedReport(null)
    setProcessingId(report.id)

    try {
      const db = getFirebaseFirestoreClient()
      
      // Ban user
      await updateDoc(doc(db, 'users', destUserID), {
        banned: true,
        updatedAt: Math.floor(Date.now() / 1000)
      })

      // Delete report
      await deleteDoc(doc(db, report.refPath))
      
      alert('User banned successfully!')
    } catch {
      alert('Error banning user')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDismiss = async (report: AbuseReport) => {
    if (!confirm('Are you sure you want to remove this report?')) return
    
    setSelectedReport(null)
    setProcessingId(report.id)

    try {
      const db = getFirebaseFirestoreClient()
      await deleteDoc(doc(db, report.refPath))
    } catch {
      alert('Error dismissing report')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-4 pb-10 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Abuse Reports</h1>
      </div>

      <p className="text-xs text-muted-foreground px-1">
        {loading ? 'Loading…' : `${reports.length} reports`}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No abuse reports
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map(report => {
            const reportedUser = report.user || {}
            const name = `${reportedUser.firstName || ''} ${reportedUser.lastName || ''}`.trim() 
              || reportedUser.email 
              || report.dest 
              || 'Unknown'

            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report)}
                disabled={processingId === report.id}
                className="w-full rounded-2xl border bg-card p-5 text-left transition-shadow hover:shadow-sm disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-bold text-blue-600 dark:text-blue-400">
                        {name}
                      </p>
                      {report.type && (
                        <span className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          {report.type}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Reported by: {report.source || 'Unknown'}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {formatDate(report.createdAt)}
                    </p>
                  </div>

                  {processingId === report.id && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Action Modal */}
      {selectedReport && (
        <ActionModal
          report={selectedReport}
          onBan={() => void handleBan(selectedReport)}
          onDismiss={() => void handleDismiss(selectedReport)}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  )
}
