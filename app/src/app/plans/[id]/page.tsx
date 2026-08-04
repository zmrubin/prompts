import Link from 'next/link'
import { notFound } from 'next/navigation'
import { clipboardText, getPlan, submitUrl } from '@/lib/plans'
import { canAutoFetch, latestMetricsFor } from '@/lib/metrics'
import { Badge, Card, PageHeader } from '@/components/ui'
import { PostCard } from './post-card'

export const dynamic = 'force-dynamic'

const OS_LABEL = {
  'open-source': 'Open source it',
  partial: 'Open source part of it',
  'keep-closed': 'Keep it closed',
} as const
const OS_TONE = { 'open-source': 'good', partial: 'warn', 'keep-closed': 'neutral' } as const

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = getPlan(id)
  if (!result) notFound()
  const { plan, project, update, items } = result

  const metricsById = latestMetricsFor(items.map((i) => i.post.id))
  const posted = items.filter((i) => i.post.status === 'posted').length
  const active = items.filter((i) => i.post.status !== 'skipped').length
  const os = plan.openSourceRec
  const pos = plan.positioning

  const tiers = ['must', 'should', 'optional'] as const

  return (
    <>
      <PageHeader
        title={update?.title ?? 'Launch plan'}
        subtitle={
          project && (
            <>
              <Link href={`/projects/${project.slug}`} className="text-accent hover:underline">
                {project.name}
              </Link>
              {' · '}
              <span className="font-mono text-xs">{plan.source}</span>
            </>
          )
        }
        action={
          <div className="text-right">
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {posted}
              <span className="text-muted">/{active}</span>
            </div>
            <div className="text-xs text-muted">posted</div>
          </div>
        }
      />

      {pos && (
        <Card className="mb-4">
          <div className="mb-3 text-xs uppercase tracking-wide text-muted">Positioning</div>
          <p className="text-lg font-medium">{pos.oneLiner}</p>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Audience</div>
              <p className="mt-1 text-muted">{pos.audience}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Differentiator</div>
              <p className="mt-1 text-muted">{pos.differentiator}</p>
            </div>
          </div>
        </Card>
      )}

      {os && (
        <Card className="mb-4">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-wide text-muted">Open source call</span>
            <Badge tone={OS_TONE[os.recommendation] ?? 'neutral'}>
              {OS_LABEL[os.recommendation] ?? os.recommendation}
            </Badge>
            <span className="text-xs text-muted">{os.confidence} confidence</span>
          </div>
          <p className="prose-copy text-sm text-muted">{os.reasoning}</p>
        </Card>
      )}

      {plan.strategyMemo && (
        <Card className="mb-4">
          <div className="mb-3 text-xs uppercase tracking-wide text-muted">Strategy</div>
          <div className="prose-copy text-sm leading-relaxed">{plan.strategyMemo}</div>
        </Card>
      )}

      {plan.assetChecklist.length > 0 && (
        <Card className="mb-8">
          <div className="mb-3 text-xs uppercase tracking-wide text-muted">
            Prepare before posting
          </div>
          <ul className="space-y-2 text-sm">
            {plan.assetChecklist.map((a, i) => (
              <li key={i} className="flex gap-2 text-muted">
                <span className="text-edge">▢</span>
                {a}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
        Posts — {items.length} venue{items.length === 1 ? '' : 's'}
      </h2>

      {tiers.map((tier) => {
        const group = items.filter((i) => i.post.priority === tier)
        if (!group.length) return null
        return (
          <section key={tier} className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Badge tone={tier === 'must' ? 'accent' : 'neutral'}>{tier}</Badge>
              <span className="text-xs text-muted">
                {group.length} venue{group.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="space-y-3">
              {group.map(({ post, channel }) => (
                <PostCard
                  key={post.id}
                  post={post}
                  channel={channel}
                  clipboard={clipboardText(post)}
                  submitUrl={submitUrl(channel, {
                    url: post.linkUrl,
                    title: post.title,
                    text: clipboardText(post),
                    repo: project?.repoUrl,
                  })}
                  metric={metricsById.get(post.id)}
                  canAutoFetch={canAutoFetch(channel.metricsSource)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
