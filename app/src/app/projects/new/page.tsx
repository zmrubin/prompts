import { redirect } from 'next/navigation'
import { generatePlan } from '@/lib/generate'
import { providersWithKeys } from '@/env'
import { Button, Card, Field, inputClass, PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

const csv = (v: FormDataEntryValue | null) =>
  String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean)

export default function NewProject() {
  const keys = providersWithKeys()

  if (!keys.length) {
    return (
      <>
        <PageHeader title="New project" />
        <Card>
          <p className="prose-copy text-sm text-muted">
            This form needs an API key. Set{' '}
            <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> or{' '}
            <code className="font-mono text-xs">GEMINI_API_KEY</code> in your environment and
            restart, or use the Claude skill instead — that path needs no key.
          </p>
        </Card>
      </>
    )
  }

  async function create(formData: FormData) {
    'use server'
    const name = String(formData.get('name') ?? '').trim()
    const updateBody = String(formData.get('updateBody') ?? '').trim()
    if (!name || !updateBody) redirect('/projects/new')

    const result = await generatePlan({
      name,
      slug: slugify(name),
      tagline: String(formData.get('tagline') ?? '') || null,
      description: String(formData.get('description') ?? '') || null,
      url: String(formData.get('url') ?? '') || null,
      repoUrl: String(formData.get('repoUrl') ?? '') || null,
      status: 'launched',
      tags: csv(formData.get('tags')),
      techStack: csv(formData.get('techStack')),
      isOpenSource: formData.get('isOpenSource') === 'on',
      targetAudience: String(formData.get('targetAudience') ?? '') || null,
      updateTitle: String(formData.get('updateTitle') ?? '') || `${name} launch`,
      updateBody,
    })

    redirect(`/plans/${result.planId}`)
  }

  return (
    <>
      <PageHeader
        title="New project"
        subtitle={`Planning with ${keys[0]}. Generation takes 20–60 seconds.`}
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
            help="What it does, who it's for, what makes it different. The main thing the planner reasons over."
          >
            <textarea name="description" rows={4} className={inputClass} />
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
            <Field label="Tags" help="Comma separated. Use 'ai' to unlock the AI directories.">
              <input name="tags" placeholder="ai, devtool" className={inputClass} />
            </Field>
            <Field label="Tech stack" help="Comma separated.">
              <input name="techStack" placeholder="Next.js, SQLite" className={inputClass} />
            </Field>
          </div>
          <Field label="Target audience">
            <input name="targetAudience" className={inputClass} />
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isOpenSource" className="size-4" />
            <span className="text-sm">Already open source</span>
          </label>

          <div className="border-t border-edge pt-5">
            <Field label="Announcement title">
              <input name="updateTitle" placeholder="Coldbrew 1.0" className={inputClass} />
            </Field>
          </div>
          <Field
            label="What's new"
            help="Bullet points are fine. Specifics — numbers, what was hard, what broke — are what make the posts land."
          >
            <textarea name="updateBody" rows={8} required className={inputClass} />
          </Field>

          <Button type="submit">Generate plan</Button>
        </form>
      </Card>
    </>
  )
}
