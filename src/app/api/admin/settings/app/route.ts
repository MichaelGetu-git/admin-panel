import { NextResponse } from 'next/server'
import { writeAuditLog } from '@/lib/server/audit-log'
import { getAdminAppSettings, updateAdminAppSettings } from '@/lib/server/app-settings'
import { jsonError, readJsonObject } from '@/lib/server/http'
import { requireAdminPermission } from '@/lib/server/permissions'

export async function GET() {
  try {
    await requireAdminPermission(['settings.read', 'settings.write'])
    const settings = await getAdminAppSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAdminPermission('settings.write')
    const body = await readJsonObject(request)
    const settings = await updateAdminAppSettings(body, user.email ?? user.uid)
    await writeAuditLog({
      action: 'settings.update',
      actor: user,
      metadata: {
        fields: Object.keys(body).sort(),
      },
      resourceId: 'app',
      resourcePath: 'admin_config/app',
      resourceType: 'settings',
    })
    return NextResponse.json({ settings })
  } catch (error) {
    return jsonError(error)
  }
}
