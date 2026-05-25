import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/server/auth'
import {
  assertAdminRole,
  removeAdminUserRole,
  updateAdminUserRole,
} from '@/lib/server/admin-roles'
import { jsonError, readJsonObject } from '@/lib/server/http'

interface RouteContext {
  params: Promise<{ uid: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireAdminRole(['owner'])
    const body = await readJsonObject(request)
    const role = assertAdminRole(body.role)
    const { uid } = await params
    const admin = await updateAdminUserRole(uid, role, actor)

    return NextResponse.json({ admin })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const actor = await requireAdminRole(['owner'])
    const { uid } = await params
    const result = await removeAdminUserRole(uid, actor)

    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
