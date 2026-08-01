import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { channels } from '@/db/schema'
import { requireAuth } from '@/lib/session'
import { Badge, Card, PageHeader } from '@/components/ui'
import { ChannelToggle } from './toggle'

export const dynamic = 'force-dynamic'

const CATEGORY_LABEL: Record<string, string> = {
  social: 'Social',
  launch_platform: 'Launch platforms',
  directory: 'Directories',
  reddit: 'Reddit',
  dev_content: 'Developer content',
  community: 'Communities',
}

const AUTOMATION: Record<string, { tone: 'good' | 'warn' | 'neutral'; label: string }> = {
  auto: { tone: 'good', label: 'Automatic' },
  gated: { tone: 'warn', label: 'Needs setup' },
  manual: { tone: 'neutral', label: 'Manual' },
}

export default async function ChannelsPage() {
  await requireAuth()

  const all = await db.select().from(channels).orderBy(asc(channels.sortOrder))

  const grouped = all.reduce<Record<string, typeof all>>((acc, c) => {
    ;(acc[c.category] ??= []).push(c)
    return acc
  }, {})

  const autoCount = all.filter((c) => c.automation === 'auto').length
  const manualCount = all.filter((c) => c.automation === 'manual').length

  return (
    <>
      <PageHeader
        title="Channels"
        subtitle={`${all.length} venues. ${autoCount} can post automatically; ${manualCount} always need a manual click.`}
      />

      <Card className="mb-8 text-sm text-muted">
        <p className="prose-copy">
          Hacker News, Product Hunt and the directories have no write API — automating a Show HN
          or a Product Hunt launch violates their rules and risks a ban, so those always land in
          your &ldquo;Needs you&rdquo; queue with copy ready to paste. Disable anything here you
          never want the model to suggest.
        </p>
      </Card>

      {Object.entries(grouped).map(([category, list]) => (
        <section key={category} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {CATEGORY_LABEL[category] ?? category}
          </h2>
          <div className="space-y-2">
            {list.map((c) => {
              const auto = AUTOMATION[c.automation]
              return (
                <Card key={c.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <Badge tone={auto.tone}>{auto.label}</Badge>
                    {c.charLimit && <Badge>{c.charLimit} chars</Badge>}
                    {c.requiresImage && <Badge tone="warn">image required</Badge>}
                    {c.requiresTags.length > 0 && (
                      <Badge>only for: {c.requiresTags.join(', ')}</Badge>
                    )}
                    <div className="flex-1" />
                    <ChannelToggle id={c.id} enabled={c.enabled} />
                  </div>
                  {c.audience && <p className="mt-1 text-xs text-muted">{c.audience}</p>}
                  {c.postingRules && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted hover:text-white">
                        Posting rules
                      </summary>
                      <p className="mt-2 text-xs text-muted prose-copy">{c.postingRules}</p>
                    </details>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
