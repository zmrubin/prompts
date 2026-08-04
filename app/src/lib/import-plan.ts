import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { channels, plans, posts, projects, updates } from '@/db/schema'
import { PlanFileSchema, type PlanFile } from './plan-file'

export type ImportResult = {
  projectSlug: string
  projectCreated: boolean
  planId: string
  postsCreated: number
  skippedChannels: string[]
  url: string
}

/**
 * Writes a plan file into the database. Upserts the project by slug, so
 * running the skill again for the same project adds an update rather than
 * duplicating it.
 */
export function importPlan(input: unknown, baseUrl = 'http://localhost:3000'): ImportResult {
  const file: PlanFile = PlanFileSchema.parse(input)

  const existing = db
    .select()
    .from(projects)
    .where(eq(projects.slug, file.project.slug))
    .get()

  let projectId: string
  const projectCreated = !existing
  if (existing) {
    // Refresh the metadata — a later plan usually knows more than the first.
    db.update(projects)
      .set({
        name: file.project.name,
        tagline: file.project.tagline ?? existing.tagline,
        description: file.project.description ?? existing.description,
        url: file.project.url ?? existing.url,
        repoUrl: file.project.repoUrl ?? existing.repoUrl,
        status: file.project.status,
        tags: file.project.tags.length ? file.project.tags : existing.tags,
        techStack: file.project.techStack.length ? file.project.techStack : existing.techStack,
        isOpenSource: file.project.isOpenSource,
        targetAudience: file.project.targetAudience ?? existing.targetAudience,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, existing.id))
      .run()
    projectId = existing.id
  } else {
    projectId = db.insert(projects).values(file.project).returning().get().id
  }

  const updateId = db
    .insert(updates)
    .values({ projectId, ...file.update })
    .returning()
    .get().id

  const planId = db
    .insert(plans)
    .values({
      updateId,
      source: file.plan.source,
      model: file.plan.model,
      strategyMemo: file.plan.strategyMemo,
      positioning: file.plan.positioning,
      openSourceRec: file.plan.openSource,
      assetChecklist: file.plan.assetChecklist,
    })
    .returning()
    .get().id

  // A plan naming a channel that isn't in the catalog is a typo, not a reason
  // to reject the whole import — drop those and report them.
  const known = new Set(db.select({ id: channels.id }).from(channels).all().map((c) => c.id))
  const seen = new Set<string>()
  const usable = file.posts.filter((p) => {
    if (!known.has(p.channelId) || seen.has(p.channelId)) return false
    seen.add(p.channelId)
    return true
  })
  const skipped = file.posts
    .map((p) => p.channelId)
    .filter((id) => !known.has(id))

  if (usable.length) {
    db.insert(posts)
      .values(
        usable.map((p) => ({
          planId,
          channelId: p.channelId,
          priority: p.priority,
          title: p.title,
          body: p.body,
          linkUrl: file.project.url,
          linkPlacement: p.linkPlacement,
          imagePrompt: p.imagePrompt,
          rationale: p.rationale,
          dayOffset: p.dayOffset,
        })),
      )
      .run()
  }

  return {
    projectSlug: file.project.slug,
    projectCreated,
    planId,
    postsCreated: usable.length,
    skippedChannels: [...new Set(skipped)],
    url: `${baseUrl}/plans/${planId}`,
  }
}
