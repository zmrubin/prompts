import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { posts } from '@/db/schema'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = (await request.json()) as {
    title?: string | null
    body?: string
    status?: 'todo' | 'posted' | 'skipped'
    postedUrl?: string | null
    notes?: string | null
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (b.title !== undefined) {
    patch.title = b.title
    patch.edited = true
  }
  if (b.body !== undefined) {
    patch.body = b.body
    patch.edited = true
  }
  if (b.notes !== undefined) patch.notes = b.notes
  if (b.postedUrl !== undefined) patch.postedUrl = b.postedUrl
  if (b.status !== undefined) {
    patch.status = b.status
    // Stamp on the way in, clear on the way back out.
    patch.postedAt = b.status === 'posted' ? new Date() : null
  }

  db.update(posts).set(patch).where(eq(posts.id, id)).run()
  return NextResponse.json({ ok: true })
}
