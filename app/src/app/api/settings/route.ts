import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { settings } from '@/db/schema'
import { isAuthed } from '@/lib/session'
import { setLlmKey } from '@/lib/settings'

export async function PATCH(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    llmProvider?: string
    llmModel?: string
    timezone?: string
    dryRun?: boolean
    apiKey?: { provider: string; key: string | null }
  }

  if (body.apiKey) {
    await setLlmKey(body.apiKey.provider, body.apiKey.key)
  }

  const patch = {
    ...(body.llmProvider ? { llmProvider: body.llmProvider } : {}),
    ...(body.llmModel ? { llmModel: body.llmModel } : {}),
    ...(body.timezone ? { timezone: body.timezone } : {}),
    ...(body.dryRun !== undefined ? { dryRun: body.dryRun } : {}),
  }

  if (Object.keys(patch).length) {
    await db
      .update(settings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(settings.id, 1))
  }

  return NextResponse.json({ ok: true })
}
