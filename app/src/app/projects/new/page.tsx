import { redirect } from 'next/navigation'
import { db } from '@/db'
import { projects } from '@/db/schema'
import { requireAuth } from '@/lib/session'
import { Button, Card, Field, inputClass, PageHeader } from '@/components/ui'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function csv(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default async function NewProject() {
  await requireAuth()

  async function create(formData: FormData) {
    'use server'
    const name = String(formData.get('name') ?? '').trim()
    if (!name) redirect('/projects/new')

    // Slug collisions are possible across similar names; suffix rather than fail.
    const base = slugify(name)
    const existing = await db.select({ slug: projects.slug }).from(projects)
    const taken = new Set(existing.map((p) => p.slug))
    let slug = base
    let n = 2
    while (taken.has(slug)) slug = `${base}-${n++}`

    await db.insert(projects).values({
      name,
      slug,
      tagline: String(formData.get('tagline') ?? '') || null,
      description: String(formData.get('description') ?? '') || null,
      url: String(formData.get('url') ?? '') || null,
      repoUrl: String(formData.get('repoUrl') ?? '') || null,
      status: (String(formData.get('status')) || 'building') as 'building',
      tags: csv(formData.get('tags')),
      techStack: csv(formData.get('techStack')),
      isOpenSource: formData.get('isOpenSource') === 'on',
      targetAudience: String(formData.get('targetAudience') ?? '') || null,
    })

    redirect(`/projects/${slug}`)
  }

  return (
    <>
      <PageHeader
        title="New project"
        subtitle="The more detail here, the better the generated copy will be."
      />
      <Card>
        <form action={create} className="space-y-5">
          <Field label="Name">
            <input name="name" required autoFocus className={inputClass} />
          </Field>

          <Field label="Tagline" help="One line. What it does, not why it's exciting.">
            <input name="tagline" className={inputClass} />
          </Field>

          <Field
            label="Description"
            help="What it does, who it's for, and what makes it different. This is the main thing the model reasons over."
          >
            <textarea name="description" rows={5} className={inputClass} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="URL">
              <input name="url" type="url" placeholder="https://" className={inputClass} />
            </Field>
            <Field label="Repo URL">
              <input name="repoUrl" type="url" placeholder="https://github.com/" className={inputClass} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Tags"
              help="Comma separated. Use 'ai' to unlock the AI directories."
            >
              <input name="tags" placeholder="ai, devtool, saas" className={inputClass} />
            </Field>
            <Field label="Tech stack" help="Comma separated.">
              <input name="techStack" placeholder="Next.js, Postgres" className={inputClass} />
            </Field>
          </div>

          <Field label="Target audience">
            <input name="targetAudience" className={inputClass} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Status">
              <select name="status" defaultValue="building" className={inputClass}>
                <option value="idea">Idea</option>
                <option value="building">Building</option>
                <option value="launched">Launched</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" name="isOpenSource" className="size-4" />
              <span className="text-sm">Already open source</span>
            </label>
          </div>

          <Button type="submit">Create project</Button>
        </form>
      </Card>
    </>
  )
}
