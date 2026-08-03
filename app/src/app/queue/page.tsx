import { desc, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { channels, postDrafts, scheduledPosts } from '@/db/schema'
import { requireAuth } from '@/lib/session'
import { Empty, PageHeader } from '@/components/ui'
import { QueueItem } from './queue-item'

export const dynamic = 'force-dynamic'

export default async function QueuePage() {
  await requireAuth()

  const rows = await db
    .select()
    .from(scheduledPosts)
    .orderBy(desc(scheduledPosts.scheduledFor))
    .limit(100)

  if (!rows.length) {
    return (
      <>
        <PageHeader title="Queue" />
        <Empty>Nothing scheduled yet. Generate a plan and schedule it.</Empty>
      </>
    )
  }

  const drafts = await db
    .select()
    .from(postDrafts)
    .where(
      inArray(
        postDrafts.id,
        rows.map((r) => r.postDraftId),
      ),
    )
  const chans = await db
    .select()
    .from(channels)
    .where(
      inArray(
        channels.id,
        rows.map((r) => r.channelId),
      ),
    )

  const draftById = new Map(drafts.map((d) => [d.id, d]))
  const channelById = new Map(chans.map((c) => [c.id, c]))

  // Upcoming reads soonest-first; history reads most-recent-first.
  const pending = rows
    .filter((r) => r.status === 'manual_pending')
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
  const scheduled = rows
    .filter((r) => ['scheduled', 'processing'].includes(r.status))
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
  const done = rows.filter((r) =>
    ['posted', 'manual_done', 'failed', 'skipped'].includes(r.status),
  )

  const groups: [string, typeof rows][] = [
    ['Needs you', pending],
    ['Scheduled', scheduled],
    ['History', done],
  ]

  return (
    <>
      <PageHeader title="Queue" subtitle="Everything scheduled, posted, or waiting on you." />
      {groups.map(([label, items]) =>
        items.length ? (
          <section key={label} className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              {label} — {items.length}
            </h2>
            <div className="space-y-3">
              {items.map((row) => {
                const draft = draftById.get(row.postDraftId)
                const channel = channelById.get(row.channelId)
                if (!draft || !channel) return null
                return (
                  <QueueItem key={row.id} row={row} draft={draft} channel={channel} />
                )
              })}
            </div>
          </section>
        ) : null,
      )}
    </>
  )
}
