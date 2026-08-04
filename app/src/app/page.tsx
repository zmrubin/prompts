import Link from 'next/link'
import { allPosts, listProjects } from '@/lib/plans'
import { providersWithKeys } from '@/env'
import { Badge, Card, Empty, LinkButton, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default function Home() {
  const projects = listProjects()
  const posts = allPosts()
  const hasKey = providersWithKeys().length > 0

  const todo = posts.filter((p) => p.post.status === 'todo')
  const posted = posts.filter((p) => p.post.status === 'posted')

  if (!projects.length) {
    return (
      <>
        <PageHeader
          title="Projects"
          subtitle="Nothing here yet."
          action={hasKey ? <LinkButton href="/projects/new">New project</LinkButton> : undefined}
        />
        <Card>
          <h2 className="mb-3 font-medium">Two ways to add a plan</h2>
          <div className="space-y-4 text-sm text-muted">
            <div>
              <div className="mb-1 font-medium text-white">Use the Claude skill (no API key)</div>
              <p className="prose-copy">
                Copy <code className="font-mono text-xs">.claude/skills/launch-plan</code> into{' '}
                <code className="font-mono text-xs">~/.claude/skills/</code>, then tell Claude
                about your project. It writes the plan and imports it here for you.
              </p>
            </div>
            <div>
              <div className="mb-1 font-medium text-white">Use your own API key</div>
              <p className="prose-copy">
                Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> (or{' '}
                <code className="font-mono text-xs">GEMINI_API_KEY</code>) in your environment and
                the <strong>New project</strong> button appears.
              </p>
            </div>
            <div>
              <div className="mb-1 font-medium text-white">Or import a file directly</div>
              <p className="prose-copy font-mono text-xs">npm run import -- plan.json</p>
            </div>
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${todo.length} post${todo.length === 1 ? '' : 's'} still to publish · ${posted.length} done`}
        action={hasKey ? <LinkButton href="/projects/new">New project</LinkButton> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => {
          const mine = posts.filter((x) => x.project?.id === p.id)
          const done = mine.filter((x) => x.post.status === 'posted').length
          const active = mine.filter((x) => x.post.status !== 'skipped').length
          return (
            <Link key={p.id} href={`/projects/${p.slug}`}>
              <Card className="h-full transition hover:border-accent/50">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <Badge tone={p.status === 'launched' ? 'good' : 'neutral'}>{p.status}</Badge>
                </div>
                <p className="text-sm text-muted">{p.tagline ?? 'No tagline yet.'}</p>
                {active > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
                      <div
                        className="h-full rounded-full bg-good transition-all"
                        style={{ width: `${Math.round((done / active) * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {done}/{active}
                    </span>
                  </div>
                )}
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
