import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { channels } from '@/db/schema'
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

export default function ChannelsPage() {
  const all = db.select().from(channels).orderBy(asc(channels.sortOrder)).all()
  const grouped = all.reduce<Record<string, typeof all>>((acc, c) => {
    ;(acc[c.category] ??= []).push(c)
    return acc
  }, {})
  const tracked = all.filter((c) => c.metricsSource).length

  return (
    <>
      <PageHeader
        title="Channels"
        subtitle={`${all.length} venues. ${tracked} can pull public stats automatically; the rest you log by hand.`}
      />
      <Card className="mb-8 text-sm text-muted">
        <p className="prose-copy">
          These rules are fed verbatim to whatever writes your plan, so editing one here changes
          the copy everywhere that venue appears. Disable anything you never want suggested.
        </p>
      </Card>

      {Object.entries(grouped).map(([category, list]) => (
        <section key={category} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {CATEGORY_LABEL[category] ?? category}
          </h2>
          <div className="space-y-2">
            {list.map((c) => (
              <Card key={c.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.charLimit && <Badge>body {c.charLimit}</Badge>}
                  {c.titleCharLimit && <Badge>title {c.titleCharLimit}</Badge>}
                  {c.requiresImage && <Badge tone="warn">image required</Badge>}
                  {c.metricsSource && <Badge tone="good">auto stats</Badge>}
                  {c.requiresTags.length > 0 && <Badge>only for: {c.requiresTags.join(', ')}</Badge>}
                  <div className="flex-1" />
                  <ChannelToggle id={c.id} enabled={c.enabled} />
                </div>
                {c.audience && <p className="mt-1 text-xs text-muted">{c.audience}</p>}
                {c.postingRules && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted hover:text-white">
                      Posting rules
                    </summary>
                    <p className="prose-copy mt-2 text-xs text-muted">{c.postingRules}</p>
                  </details>
                )}
              </Card>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
