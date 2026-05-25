import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/server/auth'
import {
  addAdminUserByEmail,
  assertAdminRole,
  listAdminUsers,
} from '@/lib/server/admin-roles'
import { jsonError, readJsonObject } from '@/lib/server/http'

export async function GET() {
  try {
    await requireAdminRole(['owner'])
    const admins = await listAdminUsers()
    return NextResponse.json({ admins })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminRole(['owner'])
    const body = await readJsonObject(request)
    const email = typeof body.email === 'string' ? body.email : ''
    const role = assertAdminRole(body.role)
    const admin = await addAdminUserByEmail(email, role, actor)

    return NextResponse.json({ admin })
  } catch (error) {
    return jsonError(error)
  }
}
