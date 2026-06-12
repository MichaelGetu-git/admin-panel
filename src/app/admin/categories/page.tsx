'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore'
import { getFirebaseFirestoreClient } from '@/lib/client/firebase'
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  PlusCircle,
  X,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name?: string
  title?: string
  order: number
  photo?: string
}

const CATEGORIES_COL = 'store_locator_categories'
const LISTINGS_COL = 'store_locator_listings'

// ── Action Modal ──────────────────────────────────────────────────────────────

function ActionModal({
  category,
  onRename,
  onEditDetails,
  onDelete,
  onClose,
}: {
  category: Category
  onRename: () => void
  onEditDetails: () => void
  onDelete: () => void
  onClose: () => void
}) {
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
          <p className="font-bold">{category.name || category.title}</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={onRename}
            className="w-full rounded-2xl border bg-muted/50 py-3.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Quick Rename
          </button>
          
          <button
            onClick={onEditDetails}
            className="w-full rounded-2xl border bg-muted/50 py-3.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Edit Details
          </button>

          <button
            onClick={onDelete}
            className="w-full rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete Category
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

export default function CategoriesPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Modals / States
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  
  const [isAdding, setIsAdding] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPhotoUrl, setAddPhotoUrl] = useState('') // Simple URL input for web parity

  const [renamingCat, setRenamingCat] = useState<Category | null>(null)
  const [renameText, setRenameText] = useState('')

  useEffect(() => {
    const db = getFirebaseFirestoreClient()
    const q = query(collection(db, CATEGORIES_COL), orderBy('order'))
    const unsub = onSnapshot(q, snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Category))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Reorder
  const moveCat = async (cat: Category, direction: 'up' | 'down') => {
    const idx = categories.findIndex(c => c.id === cat.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= categories.length) return

    try {
      const db = getFirebaseFirestoreClient()
      const batch = writeBatch(db)
      const thisRef = doc(db, CATEGORIES_COL, categories[idx].id)
      const swapRef = doc(db, CATEGORIES_COL, categories[swapIdx].id)
      
      batch.update(thisRef, { order: categories[swapIdx].order })
      batch.update(swapRef, { order: categories[idx].order })
      await batch.commit()
    } catch {
      alert('Error reordering categories')
    }
  }

  // Delete
  const handleDelete = async (cat: Category) => {
    setSelectedCat(null)
    const msg = `Are you sure you want to delete "${cat.name || cat.title}"?\n\nListings in this category will be moved to uncategorized.`
    if (!confirm(msg)) return

    try {
      const db = getFirebaseFirestoreClient()
      const batch = writeBatch(db)

      // Move orphaned listings
      const q = query(collection(db, LISTINGS_COL), where('categoryID', '==', cat.id))
      const listingsSnap = await getDocs(q)
      listingsSnap.docs.forEach(d => {
        batch.update(d.ref, { categoryID: '', categoryTitle: '' })
      })

      // Delete category
      batch.delete(doc(db, CATEGORIES_COL, cat.id))
      await batch.commit()
    } catch {
      alert('Error deleting category')
    }
  }

  // Add
  const handleAdd = async () => {
    if (!addName.trim()) return
    
    let maxOrder = 0
    categories.forEach(c => {
      if (c.order > maxOrder) maxOrder = c.order
    })

    try {
      const db = getFirebaseFirestoreClient()
      const newId = `cat_${Date.now()}`
      await setDoc(doc(db, CATEGORIES_COL, newId), {
        id: newId,
        name: addName.trim(),
        title: addName.trim(),
        order: maxOrder + 1,
        photo: addPhotoUrl.trim(),
      })
      
      setIsAdding(false)
      setAddName('')
      setAddPhotoUrl('')
    } catch {
      alert('Error adding category')
    }
  }

  // Rename
  const handleRename = async () => {
    if (!renamingCat || !renameText.trim()) return

    try {
      const db = getFirebaseFirestoreClient()
      const batch = writeBatch(db)

      // Update category
      batch.update(doc(db, CATEGORIES_COL, renamingCat.id), {
        name: renameText.trim(),
        title: renameText.trim(),
      })

      // Update references
      const q = query(collection(db, LISTINGS_COL), where('categoryID', '==', renamingCat.id))
      const listingsSnap = await getDocs(q)
      listingsSnap.docs.forEach(d => {
        batch.update(d.ref, { categoryTitle: renameText.trim() })
      })

      await batch.commit()
      setRenamingCat(null)
      setRenameText('')
    } catch {
      alert('Error renaming category')
    }
  }

  return (
    <div className="space-y-6 pb-10 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Categories</h1>
      </div>

      {/* Add New Section */}
      {isAdding ? (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Category Name"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              className="w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
              autoFocus
            />
            <input
              type="text"
              placeholder="Photo URL (optional)"
              value={addPhotoUrl}
              onChange={e => setAddPhotoUrl(e.target.value)}
              className="w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsAdding(false)}
                className="flex-1 rounded-xl bg-muted py-3 text-sm font-bold hover:bg-muted/70"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAdd()}
                disabled={!addName.trim()}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/50 bg-primary/5 py-4 font-bold text-primary transition-colors hover:bg-primary/10"
        >
          <PlusCircle className="h-5 w-5" />
          Add New Category
        </button>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="group flex items-center overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-sm"
            >
              {/* Reorder Buttons (Left side) */}
              <div className="flex flex-col border-r bg-muted/30 px-2 py-2">
                <button
                  onClick={() => void moveCat(cat, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void moveCat(cat, 'down')}
                  disabled={idx === categories.length - 1}
                  className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {/* Clickable Area */}
              <button
                className="flex flex-1 items-center gap-4 px-4 py-3 text-left"
                onClick={() => setSelectedCat(cat)}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-muted">
                  {cat.photo ? (
                    <img src={cat.photo} className="h-full w-full rounded-xl object-cover" alt="" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-bold">{cat.name || cat.title}</p>
                  <p className="text-xs text-muted-foreground">Order: {cat.order}</p>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedCat && (
        <ActionModal
          category={selectedCat}
          onRename={() => {
            setSelectedCat(null)
            setRenamingCat(selectedCat)
            setRenameText(selectedCat.name || selectedCat.title || '')
          }}
          onEditDetails={() => {
            setSelectedCat(null)
            router.push(`/admin/categories/${selectedCat.id}/update`)
          }}
          onDelete={() => void handleDelete(selectedCat)}
          onClose={() => setSelectedCat(null)}
        />
      )}

      {renamingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-bold">Rename Category</h3>
            <input
              type="text"
              value={renameText}
              onChange={e => setRenameText(e.target.value)}
              className="mb-5 w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none ring-primary focus:ring-2"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRenamingCat(null)}
                className="flex-1 rounded-xl bg-muted py-3 text-sm font-bold hover:bg-muted/70"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRename()}
                disabled={!renameText.trim()}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
