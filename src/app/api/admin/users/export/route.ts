import { NextResponse } from 'next/server'
import { getEntityConfig } from '@/generated/admin-panel.config'
import { requireAdminUser } from '@/lib/server/auth'
import { exportEntitiesCsv } from '@/lib/server/firestore-crud'
import { jsonError } from '@/lib/server/http'

const entity = getEntityConfig("users")

export async function GET(request: Request) {
  try {
    const adminUser = await requireAdminUser()
    const result = await exportEntitiesCsv(
      entity,
      new URL(request.url).searchParams,
      adminUser,
    )

    return new NextResponse(result.csv, {
      headers: {
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Type': 'text/csv; charset=utf-8',
        'X-Exported-Rows': String(result.rowCount),
      },
    })
  } catch (error) {
    return jsonError(error)
  }
}
