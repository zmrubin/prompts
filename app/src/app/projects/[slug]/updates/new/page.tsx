import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { projects, updates } from '@/db/schema'
import { requireAuth } from '@/lib/session'
import { getLlmKeys, getSettings } from '@/lib/settings'
import { Button, Card, Field, inputClass, PageHeader } from '@/components/ui'

export default async function NewUpdate({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await requireAuth()
  const { slug } = await params

  const [project] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1)
  if (!project) notFound()

  const settings = await getSettings()
  const keys = await getLlmKeys()
  const hasKey = Boolean(keys[settings.llmProvider])

  async function create(formData: FormData) {
    'use server'
    const title = String(formData.get('title') ?? '').trim()
    const body = String(formData.get('body') ?? '').trim()
    if (!title || !body) redirect(`/projects/${slug}/updates/new`)

    const [row] = await db
      .insert(updates)
      .values({
        projectId: project.id,
        kind: (String(formData.get('kind')) || 'feature') as 'feature',
        title,
        body,
        version: String(formData.get('version') ?? '') || null,
      })
      .returning()

    // Generation takes tens of seconds, so it happens on a dedicated page
    // rather than blocking this action.
    redirect(`/generate/${row.id}`)
  }

  return (
    <>
      <PageHeader
        title="New update"
        subtitle={`What's new in ${project.name}? Write it rough — the model does the polishing.`}
      />

      {!hasKey && (
        <div className="mb-6 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          No API key stored for <strong>{settings.llmProvider}</strong>. Add one in{' '}
          <a href="/settings" className="underline">
            Settings
          </a>{' '}
          or generation will fail.
        </div>
      )}

      <Card>
        <form action={create} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Title">
                <input name="title" required autoFocus className={inputClass} />
              </Field>
            </div>
            <Field label="Kind">
              <select name="kind" defaultValue="feature" className={inputClass}>
                <option value="launch">Launch</option>
                <option value="feature">Feature</option>
                <option value="milestone">Milestone</option>
                <option value="writeup">Write-up</option>
              </select>
            </Field>
          </div>

          <Field label="Version (optional)">
            <input name="version" placeholder="v1.2.0" className={inputClass} />
          </Field>

          <Field
            label="What's new"
            help="Bullet points are fine. Include specifics — numbers, what was hard, what broke. Those are what make the posts land."
          >
            <textarea name="body" rows={10} required className={inputClass} />
          </Field>

          <Button type="submit">Create and generate plan</Button>
        </form>
      </Card>
    </>
  )
}
