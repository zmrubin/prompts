import { venueStats } from '@/lib/status'
import { Badge, Card, Empty, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Which venues are worth your time. Only becomes meaningful after several
 * launches — which is exactly why it exists for someone shipping weekly.
 */
export default function PerformancePage() {
  const stats = venueStats()

  if (!stats.length) {
    return (
      <>
        <PageHeader title="Performance" />
        <Empty>
          Nothing published yet. Mark posts as posted and paste their URLs, and this fills in.
        </Empty>
      </>
    )
  }

  const scored = stats.filter((s) => s.medianScore != null)
  const solid = scored.filter((s) => s.enoughData)
  const max = Math.max(1, ...scored.map((s) => s.medianScore ?? 0))

  return (
    <>
      <PageHeader
        title="Performance"
        subtitle={
          solid.length
            ? `${solid.length} venue${solid.length === 1 ? '' : 's'} with enough history to trust. Ranked by median score.`
            : 'Ranked by median score — but nothing has three scored posts yet, so read these as anecdotes.'
        }
      />

      <Card className="mb-6 text-sm text-muted">
        <p className="prose-copy">
          A median over fewer than three posts is noise, not signal. Those rows are marked{' '}
          <span className="whitespace-nowrap">&ldquo;thin data&rdquo;</span> — don&rsquo;t
          retire a venue on the strength of one bad day.
        </p>
      </Card>

      <div className="space-y-2">
        {stats.map((s) => (
          <Card key={s.channelId} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.channelName}</span>
              <Badge>{s.posts} post{s.posts === 1 ? '' : 's'}</Badge>
              {!s.enoughData && <Badge tone="warn">thin data</Badge>}
              <div className="flex-1" />
              {s.lastPostedDaysAgo != null && (
                <span className="font-mono text-xs text-muted">
                  {s.lastPostedDaysAgo}d ago
                </span>
              )}
            </div>

            {s.medianScore != null ? (
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
                  <div
                    className={`h-full rounded-full ${s.enoughData ? 'bg-good' : 'bg-warn/60'}`}
                    style={{ width: `${Math.round(((s.medianScore ?? 0) / max) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs tabular-nums">
                  {s.medianScore} median
                  {s.bestScore != null && s.bestScore !== s.medianScore && (
                    <span className="text-muted"> · {s.bestScore} best</span>
                  )}
                  {s.medianComments != null && (
                    <span className="text-muted"> · {s.medianComments}c</span>
                  )}
                </span>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted">
                No scores recorded — paste the post URLs to track this venue.
              </p>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}
