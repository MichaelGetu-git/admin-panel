import { NextResponse } from 'next/server'
import { AuthError } from './auth'

export class HttpError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as unknown

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError('Expected a JSON object body.', 400)
  }

  return body as Record<string, unknown>
}

export function jsonError(error: unknown) {
  if (error instanceof AuthError || error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error(error)
  return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
}
