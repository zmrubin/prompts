/**
 * End-to-end smoke test against a local database. Creates a project, an
 * update, a plan and drafts, schedules them in the past, then leaves them for
 * the scheduler to drain.
 *
 *   npm run smoke && npm run scheduler
 *
 * Exercises the real code paths — planSchedule, idempotency keys, the
 * connector registry — without calling an LLM or any social API.
 */
import { oneShotDb } from '@/db'
import { channels, launchPlans, postDrafts, projects, scheduledPosts, updates } from '@/db/schema'
import { idempotencyKey, planSchedule } from '@/lib/schedule'
import { eq, inArray } from 'drizzle-orm'

async function main() {
  const { db, close } = oneShotDb()

  const [project] = await db
    .insert(projects)
    .values({
      name: 'Smoke Test Project',
      slug: `smoke-${Date.now()}`,
      tagline: 'A fixture project',
      description: 'Used only to verify the pipeline.',
      url: 'https://example.com',
      tags: ['ai'],
      techStack: ['Next.js'],
    })
    .returning()

  const [update] = await db
    .insert(updates)
    .values({
      projectId: project.id,
      kind: 'launch',
      title: 'Smoke test launch',
      body: 'Testing the pipeline.',
    })
    .returning()

  const [plan] = await db
    .insert(launchPlans)
    .values({
      updateId: update.id,
      provider: 'test',
      model: 'test',
      status: 'ready',
      strategyMemo: 'Fixture.',
    })
    .returning()

  // One auto channel and one manual channel, to prove both paths.
  const targets = await db
    .select()
    .from(channels)
    .where(inArray(channels.id, ['discord', 'hackernews']))

  const drafts = await db
    .insert(postDrafts)
    .values(
      targets.map((c) => ({
        launchPlanId: plan.id,
        channelId: c.id,
        priority: 'must' as const,
        title: 'Show HN: Smoke Test - verifying the pipeline',
        body: 'This is fixture copy produced by the smoke test.',
        linkUrl: 'https://example.com',
        linkPlacement: 'body' as const,
        suggestedOffsetHours: 0,
      })),
    )
    .returning()

  const spacing = new Map(targets.map((c) => [c.id, c.minSpacingMinutes]))
  // Schedule in the past so the very next scheduler run picks them up.
  const slots = planSchedule(
    drafts.map((d) => ({
      draftId: d.id,
      channelId: d.channelId,
      offsetHours: 0,
      minSpacingMinutes: spacing.get(d.channelId) ?? 60,
    })),
    new Date(Date.now() - 60_000),
  )

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
    .returning()

  console.log(`Created project ${project.slug}`)
  console.log(`Queued ${inserted.length} post(s):`)
  for (const row of inserted) {
    console.log(`  ${row.channelId} @ ${row.scheduledFor.toISOString()}`)
  }
  console.log('\nNow run: npm run scheduler')

  await close()
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
