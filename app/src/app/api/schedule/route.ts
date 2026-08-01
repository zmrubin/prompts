import { NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { channels, postDrafts, scheduledPosts } from '@/db/schema'
import { isAuthed } from '@/lib/session'
import { idempotencyKey, planSchedule } from '@/lib/schedule'

export async function POST(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planId, launchAt } = (await request.json()) as {
    planId?: string
    launchAt?: string
  }
  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  const launch = launchAt ? new Date(launchAt) : new Date()
  if (Number.isNaN(launch.getTime())) {
    return NextResponse.json({ error: 'Invalid launchAt' }, { status: 400 })
  }

  const drafts = await db
    .select()
    .from(postDrafts)
    .where(eq(postDrafts.launchPlanId, planId))

  if (!drafts.length) {
    return NextResponse.json({ error: 'This plan has no drafts' }, { status: 400 })
  }

  const chans = await db
    .select()
    .from(channels)
    .where(
      inArray(
        channels.id,
        drafts.map((d) => d.channelId),
      ),
    )
  const spacing = new Map(chans.map((c) => [c.id, c.minSpacingMinutes]))

  const slots = planSchedule(
    drafts.map((d) => ({
      draftId: d.id,
      channelId: d.channelId,
      offsetHours: d.suggestedOffsetHours,
      minSpacingMinutes: spacing.get(d.channelId) ?? 60,
    })),
    launch,
  )

  // onConflictDoNothing on the idempotency key makes re-scheduling the same
  // plan at the same time a no-op instead of a double post.
  const inserted = await db
    .insert(scheduledPosts)
    .values(
      slots.map((s) => ({
        postDraftId: s.draftId,
        channelId: s.channelId,
        scheduledFor: s.scheduledFor,
        idempotencyKey: idempotencyKey(s.draftId, s.scheduledFor),
      })),
    )
    .onConflictDoNothing()
    .returning({ id: scheduledPosts.id })

  return NextResponse.json({ scheduled: inserted.length, total: slots.length })
}
