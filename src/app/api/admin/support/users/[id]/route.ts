import { NextResponse } from 'next/server'
import { getSupportUser } from '@/lib/server/support'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireAdminPermission(['support.read', 'support.write'])
    const { id } = await params
    const result = await getSupportUser(id)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
