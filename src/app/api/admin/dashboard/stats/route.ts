import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/server/dashboard'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission('dashboard.read')
    const stats = await getDashboardStats()
    return NextResponse.json(stats)
  } catch (error) {
    return jsonError(error)
  }
}
