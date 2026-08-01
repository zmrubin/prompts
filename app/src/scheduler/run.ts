import { and, eq, inArray, lte, or, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { oneShotDb } from '@/db'
import { channels, connections, events, postDrafts, scheduledPosts, settings } from '@/db/schema'
import { getConnector } from '@/connectors/registry'
import { decryptJson } from '@/lib/crypto'
import { backoffMinutes } from '@/lib/schedule'
import { env } from '@/env'
import type { Creds } from '@/connectors/types'

const BATCH = 25
const MAX_ATTEMPTS = 5
const STALE_LOCK_MINUTES = 10

/**
 * Railway cron entry point. Runs every 5 minutes (Railway's minimum), drains
 * whatever is due, and exits — the container is torn down after each run, so
 * nothing may be left holding a connection.
 */
async function main() {
  const workerId = randomUUID()
  const { db, close } = oneShotDb()

  // Anything left "processing" by a crashed run goes back in the pool.
  const reclaimed = await db
    .update(scheduledPosts)
    .set({ status: 'scheduled', lockedAt: null, lockedBy: null })
    .where(
      and(
        eq(scheduledPosts.status, 'processing'),
        lte(scheduledPosts.lockedAt, new Date(Date.now() - STALE_LOCK_MINUTES * 60_000)),
      ),
    )
    .returning({ id: scheduledPosts.id })

  if (reclaimed.length) {
    console.log(`Reclaimed ${reclaimed.length} stale lock(s).`)
  }

  // Claim a batch atomically. SKIP LOCKED means two overlapping cron runs
  // never fight over the same row.
  const claimed = await db
    .update(scheduledPosts)
    .set({ status: 'processing', lockedAt: new Date(), lockedBy: workerId })
    .where(
      inArray(
        scheduledPosts.id,
        db
          .select({ id: scheduledPosts.id })
          .from(scheduledPosts)
          .where(
            and(
              eq(scheduledPosts.status, 'scheduled'),
              lte(scheduledPosts.scheduledFor, new Date()),
            ),
          )
          .limit(BATCH)
          .for('update', { skipLocked: true }),
      ),
    )
    .returning()

  if (!claimed.length) {
    console.log('Nothing due.')
    await close()
    return
  }

  console.log(`Claimed ${claimed.length} post(s).`)

  const [config] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)
  // The env var is a hard override: if it is set, nothing posts for real.
  const dryRun = env().DRY_RUN || (config?.dryRun ?? true)
  if (dryRun) console.log('DRY RUN — no real posts will be made.')

  for (const row of claimed) {
    try {
      const [draft] = await db
        .select()
        .from(postDrafts)
        .where(eq(postDrafts.id, row.postDraftId))
        .limit(1)
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, row.channelId))
        .limit(1)

      if (!draft || !channel) {
        await fail(db, row.id, 'Draft or channel no longer exists', false, row.attempts)
        continue
      }

      const connector = getConnector(channel.connectorKey)

      let creds: Creds = {}
      if (connector.mode === 'auto') {
        const [conn] = await db
          .select()
          .from(connections)
          .where(eq(connections.connectorKey, connector.key))
          .limit(1)

        if (!conn) {
          // Not connected yet — degrade to the manual path rather than failing,
          // so the post still reaches the "Needs you" queue and gets published.
          await toManual(db, row.id, channel.id, `${connector.name} is not connected.`)
          continue
        }
        creds = decryptJson<Creds>(conn.credentialsEncrypted)
      }

      const result = await connector.publish(
        {
          channel,
          title: draft.title,
          body: draft.body,
          linkUrl: draft.linkUrl,
          linkPlacement: draft.linkPlacement,
          imageUrls: [],
        },
        creds,
        { dryRun },
      )

      if (result.kind === 'posted') {
        await db
          .update(scheduledPosts)
          .set({
            status: 'posted',
            postedAt: new Date(),
            externalId: result.externalId ?? null,
            externalUrl: result.externalUrl ?? null,
            lastError: null,
            lockedAt: null,
            lockedBy: null,
          })
          .where(eq(scheduledPosts.id, row.id))
        await db.insert(events).values({
          scheduledPostId: row.id,
          event: dryRun ? 'dry_run_posted' : 'posted',
          detail: { url: result.externalUrl, note: result.note },
        })
        console.log(`  ${channel.name}: ${result.note ?? result.externalUrl ?? 'posted'}`)
      } else if (result.kind === 'manual') {
        await db
          .update(scheduledPosts)
          .set({
            status: 'manual_pending',
            externalUrl: result.submitUrl,
            lockedAt: null,
            lockedBy: null,
          })
          .where(eq(scheduledPosts.id, row.id))
        await db.insert(events).values({
          scheduledPostId: row.id,
          event: 'awaiting_manual',
          detail: { submitUrl: result.submitUrl },
        })
        console.log(`  ${channel.name}: needs a manual click`)
      } else {
        await fail(db, row.id, result.error, result.retryable, row.attempts)
        console.log(`  ${channel.name}: FAILED — ${result.error}`)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await fail(db, row.id, message, true, row.attempts)
      console.log(`  ${row.channelId}: ERROR — ${message}`)
    }
  }

  await close()
}

type Db = ReturnType<typeof oneShotDb>['db']

async function fail(
  db: Db,
  id: string,
  error: string,
  retryable: boolean,
  attempts: number,
) {
  const next = attempts + 1
  const willRetry = retryable && next < MAX_ATTEMPTS

  await db
    .update(scheduledPosts)
    .set({
      status: willRetry ? 'scheduled' : 'failed',
      attempts: next,
      lastError: error,
      lockedAt: null,
      lockedBy: null,
      ...(willRetry
        ? { scheduledFor: new Date(Date.now() + backoffMinutes(next) * 60_000) }
        : {}),
    })
    .where(eq(scheduledPosts.id, id))

  await db.insert(events).values({
    scheduledPostId: id,
    event: willRetry ? 'retry_scheduled' : 'failed',
    detail: { error, attempt: next },
  })
}

async function toManual(db: Db, id: string, channelId: string, reason: string) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1)
  await db
    .update(scheduledPosts)
    .set({
      status: 'manual_pending',
      lastError: reason,
      externalUrl: channel?.submitUrlTemplate ?? channel?.homepageUrl ?? null,
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(scheduledPosts.id, id))
  await db.insert(events).values({
    scheduledPostId: id,
    event: 'awaiting_manual',
    detail: { reason },
  })
}

main().then(
  () => {
    console.log('Scheduler run complete.')
    process.exit(0)
  },
  (err) => {
    console.error('Scheduler run failed:', err)
    process.exit(1)
  },
)
