import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { channels } from '@/db/schema'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { enabled } = (await request.json()) as { enabled?: boolean }
  if (enabled === undefined) {
    return NextResponse.json({ error: 'enabled is required' }, { status: 400 })
  }

  await db
    .update(channels)
    .set({ enabled })
    .where(eq(channels.id, decodeURIComponent(id)))

  return NextResponse.json({ ok: true })
}
