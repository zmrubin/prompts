import Link from 'next/link'
import { notFound } from 'next/navigation'
import { plansForProject, projectBySlug } from '@/lib/plans'
import { Badge, Card, Empty, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = projectBySlug(slug)
  if (!project) notFound()
  const history = plansForProject(project.id)

  return (
    <>
      <PageHeader title={project.name} subtitle={project.tagline ?? undefined} />

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
              <a href={project.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-accent hover:underline">
                {project.url}
              </a>
            </div>
          )}
          {project.repoUrl && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Repo</div>
              <a href={project.repoUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-accent hover:underline">
                {project.repoUrl}
              </a>
            </div>
          )}
        </div>
        {project.description && (
          <p className="prose-copy mt-4 border-t border-edge pt-4 text-sm text-muted">
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

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Updates</h2>
      {history.length === 0 ? (
        <Empty>No plans yet for this project.</Empty>
      ) : (
        <div className="space-y-3">
          {history.map(({ update, plan }) => (
            <Card key={update.id} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{update.title}</span>
                  <Badge>{update.kind}</Badge>
                  {update.version && <Badge>{update.version}</Badge>}
                </div>
                <p className="prose-copy mt-1 line-clamp-2 text-sm text-muted">{update.body}</p>
                <div className="mt-2 text-xs text-muted">
                  {update.createdAt.toLocaleDateString()}
                </div>
              </div>
              {plan && (
                <Link href={`/plans/${plan.id}`} className="shrink-0 text-sm text-accent hover:underline">
                  Open plan →
                </Link>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
