import Link from 'next/link'
import { desc, eq, inArray, gt, and } from 'drizzle-orm'
import { db } from '@/db'
import { channels, projects, scheduledPosts, updates } from '@/db/schema'
import { requireAuth } from '@/lib/session'
import { isDryRun } from '@/lib/settings'
import { Badge, Card, Empty, LinkButton, PageHeader, statusBadge } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  await requireAuth()
  const dryRun = await isDryRun()

  const allProjects = await db.select().from(projects).orderBy(desc(projects.updatedAt))

  const needsYou = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.status, 'manual_pending'))
    .orderBy(desc(scheduledPosts.scheduledFor))
    .limit(10)

  const upcoming = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(eq(scheduledPosts.status, 'scheduled'), gt(scheduledPosts.scheduledFor, new Date())),
    )
    .orderBy(scheduledPosts.scheduledFor)
    .limit(8)

  const recent = await db
    .select()
    .from(scheduledPosts)
    .where(inArray(scheduledPosts.status, ['posted', 'manual_done', 'failed']))
    .orderBy(desc(scheduledPosts.postedAt))
    .limit(8)

  const ids = [...needsYou, ...upcoming, ...recent].map((s) => s.channelId)
  const chans = ids.length
    ? await db.select().from(channels).where(inArray(channels.id, ids))
    : []
  const channelName = new Map(chans.map((c) => [c.id, c.name]))

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Ship something, then actually tell people about it."
        action={<LinkButton href="/projects/new">New project</LinkButton>}
      />

      {dryRun && (
        <div className="mb-6 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          <strong>Dry run is on.</strong> Posts are simulated and logged; nothing reaches a
          real account. Turn it off in Settings when you&rsquo;re ready to post for real.
        </div>
      )}

      {needsYou.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Needs you — {needsYou.length} post{needsYou.length === 1 ? '' : 's'} to submit by hand
          </h2>
          <div className="space-y-2">
            {needsYou.map((s) => (
              <Card key={s.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="text-sm font-medium">{channelName.get(s.channelId)}</div>
                  <div className="text-xs text-muted">
                    Due {s.scheduledFor.toLocaleString()}
                  </div>
                </div>
                <Link
                  href={`/queue#${s.id}`}
                  className="text-sm text-accent hover:underline"
                >
                  Open →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Projects
        </h2>
        {allProjects.length === 0 ? (
          <Empty>
            No projects yet. Add one, then create an update to generate your first launch plan.
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {allProjects.map((p) => (
              <Link key={p.id} href={`/projects/${p.slug}`}>
                <Card className="h-full transition hover:border-accent/50">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge tone={p.status === 'launched' ? 'good' : 'neutral'}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">{p.tagline ?? 'No tagline yet.'}</p>
                  {p.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <Empty>Nothing scheduled.</Empty>
          ) : (
            <Card className="divide-y divide-edge p-0">
              {upcoming.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm">{channelName.get(s.channelId)}</span>
                  <span className="text-xs text-muted">
                    {s.scheduledFor.toLocaleString()}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Recent
          </h2>
          {recent.length === 0 ? (
            <Empty>Nothing posted yet.</Empty>
          ) : (
            <Card className="divide-y divide-edge p-0">
              {recent.map((s) => {
                const badge = statusBadge(s.status)
                return (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm">{channelName.get(s.channelId)}</span>
                    <div className="flex items-center gap-2">
                      {s.externalUrl && s.status === 'posted' && (
                        <a
                          href={s.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          view
                        </a>
                      )}
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </section>
      </div>
    </>
  )
}
