'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <Button size="sm" variant="ghost" onClick={logout}>
      Logout
    </Button>
  )
}
