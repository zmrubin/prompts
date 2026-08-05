import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { channels, posts } from '@/db/schema'
import { runMigrations } from '@/db/migrate'
import { seed } from '@/db/seed'
import { PlanFileSchema } from '@/lib/plan-file'
import { importPlan } from '@/lib/import-plan'
import { clipboardText, projectBySlug, projectHistory, submitUrl } from '@/lib/plans'
import { cooldowns, outstanding, projectStatuses, venueStats } from '@/lib/status'
import { refreshMetrics } from '@/lib/metrics'
import { baseUrl } from '@/lib/config'
import { GUIDE, INSTRUCTIONS } from './instructions'

/**
 * Every tool, with no opinion about how it is being spoken to. The stdio
 * entry point and the HTTP route handler both build a server from this, which
 * is what lets the same code run as a local subprocess and as a hosted
 * connector without the two drifting apart.
 */

/**
 * Migrating at import time would run DDL inside every cold start, in the
 * request path. Do it once, on the first call that needs it.
 */
let ready = false
export function ensureReady(): void {
  if (ready) return
  runMigrations()
  seed()
  ready = true
}

const text = (s: string) => ({ content: [{ type: 'text' as const, text: s }] })
const json = (v: unknown) => text(JSON.stringify(v, null, 2))

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'pr-agent', version: '2.0.0' },
    { instructions: INSTRUCTIONS },
  )
  registerTools(server)
  return server
}

export function registerTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  server.tool(
    'list_venues',
    "The catalog of places a project can be posted, with each venue's real character limits, link policy, posting rules, cooldown state and past performance. Call this BEFORE writing a plan — never guess at limits or rules.",
    {},
    async () => {
      ensureReady()
      const cools = cooldowns()
      const stats = new Map(venueStats().map((s) => [s.channelId, s]))
      const rows = db
        .select()
        .from(channels)
        .where(eq(channels.enabled, true))
        .orderBy(asc(channels.sortOrder))
        .all()

      return json({
        venues: rows.map((c) => {
          const cool = cools.get(c.id)
          const stat = stats.get(c.id)
          return {
            id: c.id,
            name: c.name,
            category: c.category,
            charLimit: c.charLimit,
            titleCharLimit: c.titleCharLimit,
            linkPolicy: c.linkPolicy,
            requiresImage: c.requiresImage,
            requiresTags: c.requiresTags,
            audience: c.audience,
            postingRules: c.postingRules,
            bestTime: c.bestTime,
            cooldownDays: c.cooldownDays,
            cooling: cool?.cooling ?? false,
            daysUntilClear: cool?.daysRemaining ?? 0,
            daysSinceLastPost: cool?.daysSinceLastPost ?? null,
            yourMedianScore: stat?.enoughData ? stat.medianScore : null,
            yourPostCount: stat?.posts ?? 0,
          }
        }),
        note: 'Do not plan a post for a venue where cooling is true — it will be removed or downvoted. Prefer venues with a high yourMedianScore when the fit is otherwise equal.',
      })
    },
  )

  server.tool(
    'get_status',
    'Cross-project roll-up: every project, how many of its posts are published, skipped or still outstanding, and what is next up. Use this to answer "what should I post today" or "where do things stand".',
    {},
    async () => {
      ensureReady()
      const projects = projectStatuses()
      const todo = outstanding()
      return json({
        projects,
        outstanding: todo.map((o) => ({
          postId: o.post.id,
          project: o.project?.name,
          projectSlug: o.project?.slug,
          update: o.update?.title ?? null,
          venue: o.channel?.name,
          channelId: o.post.channelId,
          priority: o.post.priority,
          dayOffset: o.post.dayOffset,
          cooling: o.cooldown?.cooling ?? false,
          daysUntilClear: o.cooldown?.daysRemaining ?? 0,
          dashboardUrl: o.planId ? `${baseUrl()}/plans/${o.planId}` : undefined,
        })),
        totals: {
          projects: projects.length,
          outstanding: todo.length,
          readyNow: todo.filter((o) => !o.cooldown?.cooling).length,
          blockedByCooldown: todo.filter((o) => o.cooldown?.cooling).length,
        },
      })
    },
  )

  server.tool(
    'get_project_history',
    'Everything already posted for one project: past updates, the copy that went out at each venue, and how it performed. Read this before writing a follow-up so the new copy does not restate what previous posts already said.',
    { slug: z.string().describe('The project slug, e.g. "coldbrew".') },
    async ({ slug }) => {
      ensureReady()
      const statuses = projectStatuses()
      const summary = statuses.find((p) => p.slug === slug)
      const project = projectBySlug(slug)
      if (!summary || !project) {
        return text(
          `No project with slug "${slug}". Known slugs: ${statuses.map((s) => s.slug).join(', ') || '(none yet)'}`,
        )
      }

      const history = projectHistory(project.id)
      const posted = history.posts.filter((p) => p.status === 'posted')

      return json({
        project: summary,
        previousUpdates: history.updates.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        })),
        previouslyPosted: posted.map((p) => ({
          venue: p.venue,
          channelId: p.channelId,
          forUpdate: p.forUpdate,
          title: p.title,
          body: p.body,
          postedAt: p.postedAt?.toISOString(),
          postedUrl: p.postedUrl,
        })),
        note: "This is only this project's history. Do not restate what previousUpdates already announced or what previouslyPosted already said.",
      })
    },
  )

  server.tool(
    'get_performance',
    'Which venues actually work for this user, ranked by median score across every launch. Use it to decide where to spend effort, and to answer "how did that launch go".',
    {},
    async () => {
      ensureReady()
      const stats = venueStats()
      return json({
        venues: stats,
        note: stats.some((s) => s.enoughData)
          ? 'enoughData=false means fewer than 3 scored posts — treat that median as noise.'
          : 'Not enough history yet for any venue. Report this honestly rather than reading signal into one or two posts.',
      })
    },
  )

  server.tool(
    'get_writing_guide',
    'The full house style for launch copy: what to ask for, the per-venue rules, and how to report results back. Call this before drafting any post.',
    {},
    async () => text(GUIDE),
  )

  // -------------------------------------------------------------------------
  // Writing
  // -------------------------------------------------------------------------

  server.tool(
    'create_plan',
    'Write a launch plan into the dashboard. Reusing an existing project slug adds an update to that project rather than creating a duplicate. Returns the dashboard URL to open. Call list_venues first so the copy respects real limits and skips cooling venues.',
    { plan: PlanFileSchema },
    async ({ plan }) => {
      ensureReady()
      const result = importPlan(plan, baseUrl())
      return text(
        [
          `${result.projectCreated ? 'Created' : 'Updated'} project "${result.projectSlug}".`,
          `Wrote ${result.postsCreated} post${result.postsCreated === 1 ? '' : 's'}.`,
          result.skippedChannels.length
            ? `Dropped unknown venue ids: ${result.skippedChannels.join(', ')}`
            : null,
          ...result.corrections.map((c) => `Corrected — ${c}`),
          result.superseded.length
            ? `Superseded older un-posted copy for: ${result.superseded.join(', ')}`
            : null,
          '',
          `Open: ${result.url}`,
        ]
          .filter(Boolean)
          .join('\n'),
      )
    },
  )

  server.tool(
    'set_post_status',
    'Check a post off as posted, skip it, or reset it to todo. Pass postedUrl when marking it posted so public stats can be tracked.',
    {
      postId: z.string(),
      status: z.enum(['todo', 'posted', 'skipped']),
      postedUrl: z.string().nullable().optional(),
    },
    async ({ postId, status, postedUrl }) => {
      ensureReady()
      const existing = db.select().from(posts).where(eq(posts.id, postId)).get()
      if (!existing) return text(`No post with id ${postId}.`)

      db.update(posts)
        .set({
          status,
          postedAt: status === 'posted' ? new Date() : null,
          ...(postedUrl !== undefined ? { postedUrl } : {}),
          updatedAt: new Date(),
        })
        .where(eq(posts.id, postId))
        .run()

      const channel = db.select().from(channels).where(eq(channels.id, existing.channelId)).get()
      return text(`${channel?.name ?? existing.channelId} → ${status}.`)
    },
  )

  server.tool(
    'update_post_copy',
    'Replace the title and/or body of one post — for "rewrite the Show HN, less salesy". Does not touch the rest of the plan.',
    {
      postId: z.string(),
      title: z.string().nullable().optional(),
      body: z.string().optional(),
    },
    async ({ postId, title, body }) => {
      ensureReady()
      const existing = db.select().from(posts).where(eq(posts.id, postId)).get()
      if (!existing) return text(`No post with id ${postId}.`)
      const channel = db.select().from(channels).where(eq(channels.id, existing.channelId)).get()

      if (body && channel?.charLimit && [...body].length > channel.charLimit) {
        return text(
          `Rejected: that body is ${[...body].length} characters and ${channel.name} caps it at ${channel.charLimit}.`,
        )
      }
      if (title && channel?.titleCharLimit && [...title].length > channel.titleCharLimit) {
        return text(
          `Rejected: that title is ${[...title].length} characters and ${channel.name} caps it at ${channel.titleCharLimit}.`,
        )
      }

      db.update(posts)
        .set({
          ...(title !== undefined ? { title } : {}),
          ...(body !== undefined ? { body } : {}),
          edited: true,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, postId))
        .run()
      return text(`Updated the ${channel?.name ?? existing.channelId} post.`)
    },
  )

  server.tool(
    'refresh_stats',
    'Pull fresh public engagement numbers for everything posted recently. Works for Hacker News, Reddit and Bluesky; other venues need manual entry in the dashboard.',
    {},
    async () => {
      ensureReady()
      const rows = db.select().from(posts).where(eq(posts.status, 'posted')).all()
      const chans = new Map(db.select().from(channels).all().map((c) => [c.id, c]))
      const lines: string[] = []

      for (const p of rows) {
        const c = chans.get(p.channelId)
        if (!p.postedUrl || !c?.metricsSource) continue
        const r = await refreshMetrics(p.id, c.metricsSource, p.postedUrl)
        lines.push(
          r.error
            ? `${c.name}: ${r.error}`
            : `${c.name}: ${r.score ?? '?'} points, ${r.comments ?? '?'} comments`,
        )
      }
      return text(lines.length ? lines.join('\n') : 'Nothing posted with a URL to refresh yet.')
    },
  )

  server.tool(
    'get_post_copy',
    'The exact text to paste for one post, plus the prefilled URL of the form it goes into.',
    { postId: z.string() },
    async ({ postId }) => {
      ensureReady()
      const post = db.select().from(posts).where(eq(posts.id, postId)).get()
      if (!post) return text(`No post with id ${postId}.`)
      const channel = db.select().from(channels).where(eq(channels.id, post.channelId)).get()
      if (!channel) return text('That post points at a venue that no longer exists.')

      return json({
        venue: channel.name,
        clipboard: clipboardText(post),
        submitUrl: submitUrl(channel, {
          url: post.linkUrl,
          title: post.title,
          text: clipboardText(post),
        }),
        linkPlacement: post.linkPlacement,
        reminder:
          channel.linkPolicy === 'first_comment'
            ? `Post the body first, then add ${post.linkUrl} as the first comment — a link in the body suppresses reach here.`
            : channel.linkPolicy === 'not_clickable'
              ? 'Links are not clickable at this venue. Drive people to your bio link instead.'
              : undefined,
        postingRules: channel.postingRules,
      })
    },
  )
}
