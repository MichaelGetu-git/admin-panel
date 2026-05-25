import { NextResponse } from 'next/server'
import { listAuditLogs } from '@/lib/server/audit-log'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET(request: Request) {
  try {
    await requireAdminPermission('audit.read')
    const result = await listAuditLogs(new URL(request.url).searchParams)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
