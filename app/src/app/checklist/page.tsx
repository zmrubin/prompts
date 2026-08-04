import Link from 'next/link'
import { allPosts } from '@/lib/plans'
import { latestMetricsFor } from '@/lib/metrics'
import { Badge, Card, Empty, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Everything still to publish, across every project, ordered by the day the
 * plan suggested. This is the "what do I do today" view.
 */
export default function ChecklistPage() {
  const all = allPosts()
  const metrics = latestMetricsFor(all.map((a) => a.post.id))

  const todo = all
    .filter((a) => a.post.status === 'todo')
    .sort((a, b) => a.post.dayOffset - b.post.dayOffset || (a.channel?.sortOrder ?? 0) - (b.channel?.sortOrder ?? 0))
  const posted = all
    .filter((a) => a.post.status === 'posted')
    .sort((a, b) => (b.post.postedAt?.getTime() ?? 0) - (a.post.postedAt?.getTime() ?? 0))

  if (!all.length) {
    return (
      <>
        <PageHeader title="Checklist" />
        <Empty>No plans yet. Add a project first.</Empty>
      </>
    )
  }

  const byDay = new Map<number, typeof todo>()
  for (const item of todo) {
    const arr = byDay.get(item.post.dayOffset) ?? []
    arr.push(item)
    byDay.set(item.post.dayOffset, arr)
  }

  return (
    <>
      <PageHeader
        title="Checklist"
        subtitle={`${todo.length} to publish · ${posted.length} done`}
      />

      {todo.length === 0 ? (
        <Empty>Everything is posted. Nice.</Empty>
      ) : (
        [...byDay.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([day, items]) => (
            <section key={day} className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                {day === 0 ? 'Launch day' : `Day ${day}`}
              </h2>
              <Card className="divide-y divide-edge p-0">
                {items.map(({ post, channel, project, plan }) => (
                  <div key={post.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-edge">▢</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{channel?.name}</span>
                        <Badge tone={post.priority === 'must' ? 'accent' : 'neutral'}>
                          {post.priority}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-muted">{project?.name}</div>
                    </div>
                    {plan && (
                      <Link
                        href={`/plans/${plan.id}`}
                        className="shrink-0 text-xs text-accent hover:underline"
                      >
                        Open →
                      </Link>
                    )}
                  </div>
                ))}
              </Card>
            </section>
          ))
      )}

      {posted.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Published
          </h2>
          <Card className="divide-y divide-edge p-0">
            {posted.map(({ post, channel, project }) => {
              const m = metrics.get(post.id)
              return (
                <div key={post.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-good">✓</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{channel?.name}</div>
                    <div className="truncate text-xs text-muted">{project?.name}</div>
                  </div>
                  {m && (
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {m.score != null && `${m.score} pts`}
                      {m.score != null && m.comments != null && ' · '}
                      {m.comments != null && `${m.comments}c`}
                    </span>
                  )}
                  {post.postedUrl && (
                    <a
                      href={post.postedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs text-accent hover:underline"
                    >
                      view ↗
                    </a>
                  )}
                </div>
              )
            })}
          </Card>
        </section>
      )}
    </>
  )
}
