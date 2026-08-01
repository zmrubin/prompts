import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { events, scheduledPosts } from '@/db/schema'
import { isAuthed } from '@/lib/session'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json()) as {
    action?: 'mark_posted' | 'skip' | 'reschedule' | 'retry'
    scheduledFor?: string
    externalUrl?: string
  }

  switch (body.action) {
    case 'mark_posted':
      await db
        .update(scheduledPosts)
        .set({
          status: 'manual_done',
          postedAt: new Date(),
          ...(body.externalUrl ? { externalUrl: body.externalUrl } : {}),
        })
        .where(eq(scheduledPosts.id, id))
      await db.insert(events).values({ scheduledPostId: id, event: 'marked_posted' })
      break

    case 'skip':
      await db
        .update(scheduledPosts)
        .set({ status: 'skipped' })
        .where(eq(scheduledPosts.id, id))
      await db.insert(events).values({ scheduledPostId: id, event: 'skipped' })
      break

    case 'retry':
      // Reset attempts so a fixed credential gets a clean run of retries.
      await db
        .update(scheduledPosts)
        .set({
          status: 'scheduled',
          attempts: 0,
          lastError: null,
          scheduledFor: new Date(),
        })
        .where(eq(scheduledPosts.id, id))
      await db.insert(events).values({ scheduledPostId: id, event: 'retry_requested' })
      break

    case 'reschedule': {
      if (!body.scheduledFor) {
        return NextResponse.json({ error: 'scheduledFor is required' }, { status: 400 })
      }
      const at = new Date(body.scheduledFor)
      if (Number.isNaN(at.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledFor' }, { status: 400 })
      }
      await db
        .update(scheduledPosts)
        .set({ status: 'scheduled', scheduledFor: at })
        .where(eq(scheduledPosts.id, id))
      break
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  await db.delete(scheduledPosts).where(eq(scheduledPosts.id, id))
  return NextResponse.json({ ok: true })
}
