import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { launchPlans, projects, updates } from '@/db/schema'
import { requireAuth } from '@/lib/session'
import { Badge, Card, Empty, LinkButton, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await requireAuth()
  const { slug } = await params

  const [project] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1)
  if (!project) notFound()

  const projectUpdates = await db
    .select()
    .from(updates)
    .where(eq(updates.projectId, project.id))
    .orderBy(desc(updates.createdAt))

  const plans = projectUpdates.length
    ? await db
        .select()
        .from(launchPlans)
        .where(
          inArray(
            launchPlans.updateId,
            projectUpdates.map((u) => u.id),
          ),
        )
        .orderBy(desc(launchPlans.createdAt))
    : []

  const planByUpdate = new Map<string, (typeof plans)[number]>()
  for (const p of plans) if (!planByUpdate.has(p.updateId)) planByUpdate.set(p.updateId, p)

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={project.tagline ?? undefined}
        action={<LinkButton href={`/projects/${slug}/updates/new`}>New update</LinkButton>}
      />

      <Card className="mb-8">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Status</div>
            <div className="mt-1">{project.status}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Open source</div>
            <div className="mt-1">{project.isOpenSource ? 'Yes' : 'No'}</div>
          </div>
          {project.url && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">URL</div>
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-accent hover:underline"
              >
                {project.url}
              </a>
            </div>
          )}
          {project.repoUrl && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Repo</div>
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-accent hover:underline"
              >
                {project.repoUrl}
              </a>
            </div>
          )}
        </div>
        {project.description && (
          <p className="mt-4 border-t border-edge pt-4 text-sm text-muted prose-copy">
            {project.description}
          </p>
        )}
        {project.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {project.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        )}
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Updates
      </h2>
      {projectUpdates.length === 0 ? (
        <Empty>
          No updates yet. Create one to generate a launch plan and post copy for every channel.
        </Empty>
      ) : (
        <div className="space-y-3">
          {projectUpdates.map((u) => {
            const plan = planByUpdate.get(u.id)
            return (
              <Card key={u.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.title}</span>
                    <Badge>{u.kind}</Badge>
                    {u.version && <Badge>{u.version}</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{u.body}</p>
                  <div className="mt-2 text-xs text-muted">
                    {u.createdAt.toLocaleDateString()}
                  </div>
                </div>
                {plan?.status === 'ready' ? (
                  <Link
                    href={`/plans/${plan.id}`}
                    className="shrink-0 text-sm text-accent hover:underline"
                  >
                    View plan →
                  </Link>
                ) : plan?.status === 'failed' ? (
                  <Badge tone="bad">Generation failed</Badge>
                ) : (
                  <Link
                    href={`/projects/${slug}/updates/new?updateId=${u.id}`}
                    className="shrink-0 text-sm text-accent hover:underline"
                  >
                    Generate plan →
                  </Link>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
