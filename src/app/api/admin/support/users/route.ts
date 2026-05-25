import { NextResponse } from 'next/server'
import { searchSupportUsers } from '@/lib/server/support'
import { jsonError } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET(request: Request) {
  try {
    await requireAdminPermission(['support.read', 'support.write'])
    const result = await searchSupportUsers(new URL(request.url).searchParams)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
