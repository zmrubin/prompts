import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { channels, plans, posts, projects, updates } from '@/db/schema'

/** Fills {url}, {title}, {text} and {repo} in a channel's submit template. */
export function submitUrl(
  channel: { submitUrlTemplate: string | null; homepageUrl: string | null },
  vars: { url?: string | null; title?: string | null; text?: string | null; repo?: string | null },
): string {
  const t = channel.submitUrlTemplate ?? channel.homepageUrl ?? ''
  return t
    .replace('{url}', encodeURIComponent(vars.url ?? ''))
    .replace('{title}', encodeURIComponent(vars.title ?? ''))
    .replace('{text}', encodeURIComponent(vars.text ?? ''))
    .replace('{repo}', vars.repo ?? '')
}

/** What actually goes on the clipboard for a given post. */
export function clipboardText(p: {
  title: string | null
  body: string
  linkUrl: string | null
  linkPlacement: string
}): string {
  const parts = [p.title, p.body]
  if (p.linkUrl && p.linkPlacement === 'body') parts.push(p.linkUrl)
  return parts.filter(Boolean).join('\n\n')
}

const PRIORITY = { must: 0, should: 1, optional: 2 } as const

export function getPlan(planId: string) {
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get()
  if (!plan) return null

  const update = db.select().from(updates).where(eq(updates.id, plan.updateId)).get()
  const project = update
    ? db.select().from(projects).where(eq(projects.id, update.projectId)).get()
    : undefined

  const rows = db.select().from(posts).where(eq(posts.planId, planId)).all()
  const chans = rows.length
    ? db
        .select()
        .from(channels)
        .where(inArray(channels.id, rows.map((r) => r.channelId)))
        .all()
    : []
  const byId = new Map(chans.map((c) => [c.id, c]))

  // Stable: priority, then day, then the channel's own order, then id.
  rows.sort(
    (a, b) =>
      PRIORITY[a.priority] - PRIORITY[b.priority] ||
      a.dayOffset - b.dayOffset ||
      (byId.get(a.channelId)?.sortOrder ?? 0) - (byId.get(b.channelId)?.sortOrder ?? 0) ||
      a.channelId.localeCompare(b.channelId),
  )

  return {
    plan,
    project,
    update,
    items: rows.map((post) => ({ post, channel: byId.get(post.channelId)! })),
  }
}

export function listProjects() {
  return db.select().from(projects).orderBy(desc(projects.updatedAt)).all()
}

export function projectBySlug(slug: string) {
  return db.select().from(projects).where(eq(projects.slug, slug)).get()
}

export function plansForProject(projectId: string) {
  const ups = db
    .select()
    .from(updates)
    .where(eq(updates.projectId, projectId))
    .orderBy(desc(updates.createdAt))
    .all()
  if (!ups.length) return []
  const ps = db
    .select()
    .from(plans)
    .where(inArray(plans.updateId, ups.map((u) => u.id)))
    .orderBy(desc(plans.createdAt))
    .all()
  return ups.map((update) => ({ update, plan: ps.find((p) => p.updateId === update.id) }))
}

/**
 * One project's own history: what was announced, and what copy went out
 * where. Scoped through updates → plans → posts, so a follow-up plan is
 * never shown another project's copy — which would be worse than showing
 * nothing, since the writer would avoid repeating things it never said.
 */
export function projectHistory(projectId: string) {
  const ups = db
    .select()
    .from(updates)
    .where(eq(updates.projectId, projectId))
    .orderBy(desc(updates.createdAt))
    .all()
  if (!ups.length) return { updates: [], posts: [] }

  const ps = db
    .select()
    .from(plans)
    .where(inArray(plans.updateId, ups.map((u) => u.id)))
    .all()
  const rows = ps.length
    ? db
        .select()
        .from(posts)
        .where(inArray(posts.planId, ps.map((p) => p.id)))
        .all()
    : []

  const chanNames = new Map(db.select().from(channels).all().map((c) => [c.id, c.name]))
  const updateOfPlan = new Map(ps.map((p) => [p.id, p.updateId]))
  const updateTitle = new Map(ups.map((u) => [u.id, u.title]))

  return {
    updates: ups.map((u) => ({
      title: u.title,
      kind: u.kind,
      version: u.version,
      body: u.body,
      createdAt: u.createdAt,
    })),
    posts: rows.map((p) => ({
      venue: chanNames.get(p.channelId) ?? p.channelId,
      channelId: p.channelId,
      forUpdate: updateTitle.get(updateOfPlan.get(p.planId) ?? '') ?? null,
      status: p.status,
      title: p.title,
      body: p.body,
      postedAt: p.postedAt,
      postedUrl: p.postedUrl,
    })),
  }
}

/** Every post across every plan, for the global checklist. */
export function allPosts() {
  const rows = db.select().from(posts).all()
  const chans = db.select().from(channels).orderBy(asc(channels.sortOrder)).all()
  const byId = new Map(chans.map((c) => [c.id, c]))
  const planRows = db.select().from(plans).all()
  const updateRows = db.select().from(updates).all()
  const projectRows = db.select().from(projects).all()

  return rows.map((post) => {
    const plan = planRows.find((p) => p.id === post.planId)
    const update = updateRows.find((u) => u.id === plan?.updateId)
    const project = projectRows.find((p) => p.id === update?.projectId)
    return { post, channel: byId.get(post.channelId)!, plan, update, project }
  })
}

export function enabledChannels() {
  return db.select().from(channels).where(eq(channels.enabled, true)).orderBy(asc(channels.sortOrder)).all()
}
