import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  clearAdminSession,
  createAdminSession,
  requireAdminUser,
} from '@/lib/server/auth'
import { jsonError } from '@/lib/server/http'

const createSessionSchema = z.object({
  idToken: z.string().min(1),
})

export async function GET() {
  try {
    const user = await requireAdminUser()
    return NextResponse.json({ user })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as unknown
    const parsed = createSessionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid Firebase ID token.' }, { status: 400 })
    }

    const user = await createAdminSession(parsed.data.idToken)
    return NextResponse.json({ user })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE() {
  await clearAdminSession()
  return NextResponse.json({ success: true })
}
