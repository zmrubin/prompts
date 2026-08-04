import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { channels, metrics, plans, posts, projects, updates } from '@/db/schema'

const DAY = 86_400_000

export type Cooldown = {
  channelId: string
  cooldownDays: number | null
  /** Days since the last time anything was posted here, across all projects. */
  daysSinceLastPost: number | null
  cooling: boolean
  /** Days until it's safe again. 0 when clear. */
  daysRemaining: number
  lastPostedProject?: string
}

/**
 * Cooldowns are computed across *all* projects, not per project. A subreddit
 * does not care that your last post there was for a different side project —
 * it sees the same account promoting something again.
 */
export function cooldowns(): Map<string, Cooldown> {
  const chans = db.select().from(channels).all()
  const posted = db
    .select()
    .from(posts)
    .where(eq(posts.status, 'posted'))
    .orderBy(desc(posts.postedAt))
    .all()

  const projectNames = new Map(db.select().from(projects).all().map((p) => [p.id, p.name]))
  const planRows = db.select().from(plans).all()
  const updateRows = db.select().from(updates).all()
  const projectOf = (planId: string) => {
    const plan = planRows.find((p) => p.id === planId)
    const update = updateRows.find((u) => u.id === plan?.updateId)
    return update ? projectNames.get(update.projectId) : undefined
  }

  const out = new Map<string, Cooldown>()
  for (const c of chans) {
    const last = posted.find((p) => p.channelId === c.id && p.postedAt)
    const days = last?.postedAt
      ? Math.floor((Date.now() - last.postedAt.getTime()) / DAY)
      : null
    const limit = c.cooldownDays ?? 0
    const cooling = days !== null && limit > 0 && days < limit
    out.set(c.id, {
      channelId: c.id,
      cooldownDays: c.cooldownDays,
      daysSinceLastPost: days,
      cooling,
      daysRemaining: cooling ? limit - (days as number) : 0,
      lastPostedProject: last ? projectOf(last.planId) : undefined,
    })
  }
  return out
}

export type ProjectStatus = {
  slug: string
  name: string
  status: string
  total: number
  posted: number
  todo: number
  skipped: number
  latestPlanId?: string
  nextUp: { channelId: string; channelName: string; dayOffset: number }[]
}

/** Cross-project roll-up: what's outstanding everywhere, at a glance. */
export function projectStatuses(): ProjectStatus[] {
  const allProjects = db.select().from(projects).orderBy(desc(projects.updatedAt)).all()
  const allUpdates = db.select().from(updates).all()
  const allPlans = db.select().from(plans).orderBy(desc(plans.createdAt)).all()
  const allPosts = db.select().from(posts).all()
  const chanNames = new Map(
    db.select().from(channels).orderBy(asc(channels.sortOrder)).all().map((c) => [c.id, c.name]),
  )

  return allProjects.map((project) => {
    const updateIds = new Set(
      allUpdates.filter((u) => u.projectId === project.id).map((u) => u.id),
    )
    const planIds = new Set(allPlans.filter((p) => updateIds.has(p.updateId)).map((p) => p.id))
    const mine = allPosts.filter((p) => planIds.has(p.planId))
    const latestPlan = allPlans.find((p) => updateIds.has(p.updateId))

    const todo = mine.filter((p) => p.status === 'todo')
    return {
      slug: project.slug,
      name: project.name,
      status: project.status,
      total: mine.length,
      posted: mine.filter((p) => p.status === 'posted').length,
      todo: todo.length,
      skipped: mine.filter((p) => p.status === 'skipped').length,
      latestPlanId: latestPlan?.id,
      nextUp: todo
        .sort((a, b) => a.dayOffset - b.dayOffset)
        .slice(0, 3)
        .map((p) => ({
          channelId: p.channelId,
          channelName: chanNames.get(p.channelId) ?? p.channelId,
          dayOffset: p.dayOffset,
        })),
    }
  })
}

export type VenueStat = {
  channelId: string
  channelName: string
  posts: number
  medianScore: number | null
  medianComments: number | null
  bestScore: number | null
  lastPostedDaysAgo: number | null
  /** Under 3 samples a median means very little; say so rather than imply rigour. */
  enoughData: boolean
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/** Which venues actually work, ranked. Only meaningful after a few launches. */
export function venueStats(): VenueStat[] {
  const chans = db.select().from(channels).all()
  const postedRows = db.select().from(posts).where(eq(posts.status, 'posted')).all()
  const allMetrics = db.select().from(metrics).orderBy(desc(metrics.capturedAt)).all()

  // Latest reading per post.
  const latest = new Map<string, (typeof allMetrics)[number]>()
  for (const m of allMetrics) if (!latest.has(m.postId)) latest.set(m.postId, m)

  const stats: VenueStat[] = []
  for (const c of chans) {
    const mine = postedRows.filter((p) => p.channelId === c.id)
    if (!mine.length) continue
    const scores = mine.map((p) => latest.get(p.id)?.score).filter((n): n is number => n != null)
    const comments = mine
      .map((p) => latest.get(p.id)?.comments)
      .filter((n): n is number => n != null)
    const lastAt = mine
      .map((p) => p.postedAt?.getTime() ?? 0)
      .reduce((a, b) => Math.max(a, b), 0)

    stats.push({
      channelId: c.id,
      channelName: c.name,
      posts: mine.length,
      medianScore: median(scores),
      medianComments: median(comments),
      bestScore: scores.length ? Math.max(...scores) : null,
      lastPostedDaysAgo: lastAt ? Math.floor((Date.now() - lastAt) / DAY) : null,
      enoughData: scores.length >= 3,
    })
  }

  return stats.sort(
    (a, b) => (b.medianScore ?? -1) - (a.medianScore ?? -1) || b.posts - a.posts,
  )
}

/** Everything still to do, across every project, in the order to do it. */
export function outstanding() {
  const allPosts = db.select().from(posts).where(eq(posts.status, 'todo')).all()
  const chans = new Map(db.select().from(channels).all().map((c) => [c.id, c]))
  const allPlans = db.select().from(plans).all()
  const allUpdates = db.select().from(updates).all()
  const allProjects = db.select().from(projects).all()
  const cools = cooldowns()

  return allPosts
    .map((post) => {
      const plan = allPlans.find((p) => p.id === post.planId)
      const update = allUpdates.find((u) => u.id === plan?.updateId)
      const project = allProjects.find((p) => p.id === update?.projectId)
      return {
        post,
        channel: chans.get(post.channelId),
        project,
        update,
        planId: plan?.id,
        cooldown: cools.get(post.channelId),
      }
    })
    .sort(
      (a, b) =>
        a.post.dayOffset - b.post.dayOffset ||
        (a.channel?.sortOrder ?? 0) - (b.channel?.sortOrder ?? 0),
    )
}
