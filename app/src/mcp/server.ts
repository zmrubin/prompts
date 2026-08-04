#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { channels, posts } from '@/db/schema'
import { runMigrations } from '@/db/migrate'
import { seed } from '@/db/seed'
import { PlanFileSchema } from '@/lib/plan-file'
import { importPlan } from '@/lib/import-plan'
import { clipboardText, getPlan, projectBySlug, projectHistory, submitUrl } from '@/lib/plans'
import { cooldowns, outstanding, projectStatuses, venueStats } from '@/lib/status'
import { refreshMetrics } from '@/lib/metrics'
import { ensureDashboard, dashboardUrl } from './dashboard'

/**
 * Local MCP server, spoken over stdio. Claude Code launches this as a
 * subprocess, so there is nothing to start by hand — registering it once with
 * `claude mcp add` is the entire setup.
 *
 * The database is migrated and seeded on boot, so a fresh clone works on the
 * first call with no setup step at all.
 */
runMigrations()
seed()

const server = new McpServer({ name: 'pr-agent', version: '1.0.0' })

const text = (s: string) => ({ content: [{ type: 'text' as const, text: s }] })
const json = (v: unknown) => text(JSON.stringify(v, null, 2))

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

server.tool(
  'list_venues',
  "The catalog of places a project can be posted, with each venue's real character limits, link policy, posting rules, cooldown state and past performance. Call this BEFORE writing a plan — never guess at limits or rules.",
  {},
  async () => {
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
    const projects = projectStatuses()
    const todo = outstanding()
    return json({
      projects,
      outstanding: todo.map((o) => ({
        postId: o.post.id,
        project: o.project?.name,
        projectSlug: o.project?.slug,
        venue: o.channel?.name,
        channelId: o.post.channelId,
        priority: o.post.priority,
        dayOffset: o.post.dayOffset,
        cooling: o.cooldown?.cooling ?? false,
        daysUntilClear: o.cooldown?.daysRemaining ?? 0,
        dashboardUrl: o.planId ? `${dashboardUrl()}/plans/${o.planId}` : undefined,
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
      note: 'This is only this project\'s history. Do not restate what previousUpdates already announced or what previouslyPosted already said.',
    })
  },
)

server.tool(
  'get_performance',
  'Which venues actually work for this user, ranked by median score across every launch. Use it to decide where to spend effort, and to answer "how did that launch go".',
  {},
  async () => {
    const stats = venueStats()
    return json({
      venues: stats,
      note:
        stats.some((s) => s.enoughData)
          ? 'enoughData=false means fewer than 3 scored posts — treat that median as noise.'
          : 'Not enough history yet for any venue. Report this honestly rather than reading signal into one or two posts.',
    })
  },
)

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

server.tool(
  'create_plan',
  'Write a launch plan into the dashboard. Reusing an existing project slug adds an update to that project rather than creating a duplicate. Returns the dashboard URL to open. Call list_venues first so the copy respects real limits and skips cooling venues.',
  { plan: PlanFileSchema },
  async ({ plan }) => {
    const url = dashboardUrl()
    const result = importPlan(plan, url)
    await ensureDashboard()
    return text(
      [
        `${result.projectCreated ? 'Created' : 'Updated'} project "${result.projectSlug}".`,
        `Wrote ${result.postsCreated} post${result.postsCreated === 1 ? '' : 's'}.`,
        result.skippedChannels.length
          ? `Dropped unknown venue ids: ${result.skippedChannels.join(', ')}`
          : null,
        ...result.corrections.map((c) => `Corrected — ${c}`),
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

    const channel = db
      .select()
      .from(channels)
      .where(eq(channels.id, existing.channelId))
      .get()
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
  'open_dashboard',
  'Start the dashboard if it is not already running and return its URL. Optionally deep-links to one plan.',
  { planId: z.string().optional() },
  async ({ planId }) => {
    const started = await ensureDashboard()
    const base = dashboardUrl()
    if (planId) {
      const plan = getPlan(planId)
      if (!plan) return text(`No plan with id ${planId}. Dashboard: ${base}`)
    }
    return text(
      `${started ? 'Started the dashboard.' : 'Dashboard already running.'} ${
        planId ? `${base}/plans/${planId}` : base
      }`,
    )
  },
)

server.tool(
  'get_post_copy',
  'The exact text to paste for one post, plus the prefilled URL of the form it goes into.',
  { postId: z.string() },
  async ({ postId }) => {
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

// Wrapped rather than top-level await: this package is CommonJS, and tsx
// refuses top-level await outside an ES module.
async function main() {
  await server.connect(new StdioServerTransport())
}

main().catch((e) => {
  // stdout is the JSON-RPC channel, so diagnostics must go to stderr.
  console.error('pr-agent MCP server failed to start:', e)
  process.exit(1)
})
