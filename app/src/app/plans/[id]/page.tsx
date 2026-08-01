import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/session'
import { getPlanWithDrafts } from '@/lib/plans'
import { Badge, Card, PageHeader } from '@/components/ui'
import { DraftEditor } from './draft-editor'
import { ScheduleAll } from './schedule-all'

export const dynamic = 'force-dynamic'

const OS_TONE = {
  'open-source': 'good',
  partial: 'warn',
  'keep-closed': 'neutral',
} as const

const OS_LABEL = {
  'open-source': 'Open source it',
  partial: 'Open source part of it',
  'keep-closed': 'Keep it closed',
} as const

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth()
  const { id } = await params

  const result = await getPlanWithDrafts(id)
  if (!result) notFound()
  const { plan, project, update, drafts } = result

  const positioning = plan.positioning as {
    oneLiner?: string
    audience?: string
    differentiator?: string
  } | null
  const openSource = plan.openSourceRec as {
    recommendation?: keyof typeof OS_LABEL
    reasoning?: string
    confidence?: string
  } | null

  const byPriority = {
    must: drafts.filter((d) => d.draft.priority === 'must'),
    should: drafts.filter((d) => d.draft.priority === 'should'),
    optional: drafts.filter((d) => d.draft.priority === 'optional'),
  }

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
              {plan.provider}/{plan.model}
            </>
          )
        }
      />

      {plan.status === 'failed' && (
        <Card className="mb-6 border-bad/40">
          <div className="font-medium text-bad">Generation failed</div>
          <p className="mt-1 text-sm text-muted prose-copy">{plan.error}</p>
        </Card>
      )}

      {positioning?.oneLiner && (
        <Card className="mb-6">
          <div className="mb-3 text-xs uppercase tracking-wide text-muted">Positioning</div>
          <p className="text-lg font-medium">{positioning.oneLiner}</p>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Audience</div>
              <p className="mt-1 text-muted">{positioning.audience}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Differentiator</div>
              <p className="mt-1 text-muted">{positioning.differentiator}</p>
            </div>
          </div>
        </Card>
      )}

      {openSource?.recommendation && (
        <Card className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-xs uppercase tracking-wide text-muted">
              Open source call
            </span>
            <Badge tone={OS_TONE[openSource.recommendation] ?? 'neutral'}>
              {OS_LABEL[openSource.recommendation] ?? openSource.recommendation}
            </Badge>
            <span className="text-xs text-muted">{openSource.confidence} confidence</span>
          </div>
          <p className="text-sm text-muted prose-copy">{openSource.reasoning}</p>
        </Card>
      )}

      {plan.strategyMemo && (
        <Card className="mb-6">
          <div className="mb-3 text-xs uppercase tracking-wide text-muted">Strategy</div>
          <div className="text-sm leading-relaxed prose-copy">{plan.strategyMemo}</div>
        </Card>
      )}

      {plan.assetChecklist.length > 0 && (
        <Card className="mb-8">
          <div className="mb-3 text-xs uppercase tracking-wide text-muted">
            Prepare before launching
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

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Posts — {drafts.length} channel{drafts.length === 1 ? '' : 's'}
        </h2>
        {drafts.length > 0 && <ScheduleAll planId={plan.id} />}
      </div>

      {(['must', 'should', 'optional'] as const).map((tier) =>
        byPriority[tier].length ? (
          <section key={tier} className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Badge tone={tier === 'must' ? 'accent' : 'neutral'}>{tier}</Badge>
              <span className="text-xs text-muted">
                {byPriority[tier].length} channel{byPriority[tier].length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="space-y-3">
              {byPriority[tier].map(({ draft, channel }) => (
                <DraftEditor key={draft.id} draft={draft} channel={channel} />
              ))}
            </div>
          </section>
        ) : null,
      )}
    </>
  )
}
