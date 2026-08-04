import { relations, sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * SQLite, single file, no server. This is a desktop planning tool — the whole
 * database lives at ./data/pragent.db and can be copied, backed up, or deleted
 * like any other file.
 *
 * Arrays are stored as JSON text; SQLite has no array type and a helper
 * column would be more machinery than a personal tool needs.
 */

const now = sql`(unixepoch())`

/** Comma-free JSON list helper, typed as string[] at the boundary. */
const jsonList = (name: string) =>
  text(name, { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`)

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  tagline: text('tagline'),
  description: text('description'),
  url: text('url'),
  repoUrl: text('repo_url'),
  status: text('status', { enum: ['idea', 'building', 'launched', 'archived'] })
    .notNull()
    .default('building'),
  tags: jsonList('tags'),
  techStack: jsonList('tech_stack'),
  isOpenSource: integer('is_open_source', { mode: 'boolean' }).notNull().default(false),
  targetAudience: text('target_audience'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
})

export const updates = sqliteTable(
  'updates',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['launch', 'feature', 'milestone', 'writeup'] })
      .notNull()
      .default('feature'),
    title: text('title').notNull(),
    /** Your raw notes. The planner turns these into copy. */
    body: text('body').notNull(),
    version: text('version'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({ projectIdx: index('updates_project_idx').on(t.projectId) }),
)

/**
 * The venue catalog. Rules live here rather than in code so one row feeds the
 * planner prompt, the character counters, and the submit deep link at once.
 */
export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category', {
    enum: ['social', 'launch_platform', 'directory', 'reddit', 'dev_content', 'community'],
  }).notNull(),
  /** Where the copy actually gets pasted. Every channel has one now. */
  submitUrlTemplate: text('submit_url_template'),
  homepageUrl: text('homepage_url'),
  charLimit: integer('char_limit'),
  titleCharLimit: integer('title_char_limit'),
  requiresImage: integer('requires_image', { mode: 'boolean' }).notNull().default(false),
  linkPolicy: text('link_policy', {
    enum: ['fine', 'penalized', 'first_comment', 'not_clickable'],
  })
    .notNull()
    .default('fine'),
  audience: text('audience'),
  /** Fed verbatim to the planner. */
  postingRules: text('posting_rules'),
  bestTime: text('best_time'),
  /** Only suggest when the project carries one of these tags. */
  requiresTags: jsonList('requires_tags'),
  /** Which public metrics fetcher can read this venue's stats, if any. */
  metricsSource: text('metrics_source', { enum: ['hackernews', 'reddit', 'bluesky'] }),
  /**
   * How long this venue expects you to wait between self-promotional posts.
   * Not a scheduler — it drives a warning, and the planner skips venues that
   * are still cooling. Posting weekly to a sub that expects monthly is the
   * fastest way to get removed or banned.
   */
  cooldownDays: integer('cooldown_days'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(100),
})

export const plans = sqliteTable(
  'plans',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    updateId: text('update_id')
      .notNull()
      .references(() => updates.id, { onDelete: 'cascade' }),
    /** "claude-skill" when authored by the Claude skill, else provider id. */
    source: text('source').notNull().default('api'),
    model: text('model'),
    strategyMemo: text('strategy_memo'),
    positioning: text('positioning', { mode: 'json' }).$type<{
      oneLiner: string
      audience: string
      differentiator: string
    } | null>(),
    openSourceRec: text('open_source_rec', { mode: 'json' }).$type<{
      recommendation: 'open-source' | 'keep-closed' | 'partial'
      reasoning: string
      confidence: 'low' | 'medium' | 'high'
    } | null>(),
    assetChecklist: jsonList('asset_checklist'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({ updateIdx: index('plans_update_idx').on(t.updateId) }),
)

/**
 * One row per venue per plan. This is the unit the dashboard is built around:
 * copy to paste, a link to paste it into, a checkbox, and a result.
 */
export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id),
    priority: text('priority', { enum: ['must', 'should', 'optional'] })
      .notNull()
      .default('should'),
    title: text('title'),
    body: text('body').notNull(),
    linkUrl: text('link_url'),
    linkPlacement: text('link_placement', { enum: ['body', 'first_comment', 'none'] })
      .notNull()
      .default('body'),
    imagePrompt: text('image_prompt'),
    /** Why the planner chose this framing. Shown above the copy. */
    rationale: text('rationale'),
    /** Days after launch to post. Ordering hint, not a scheduler. */
    dayOffset: integer('day_offset').notNull().default(0),
    status: text('status', { enum: ['todo', 'posted', 'skipped'] })
      .notNull()
      .default('todo'),
    postedAt: integer('posted_at', { mode: 'timestamp' }),
    /** Pasted back after posting. Unlocks metrics for supported venues. */
    postedUrl: text('posted_url'),
    notes: text('notes'),
    edited: integer('edited', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({
    planIdx: index('posts_plan_idx').on(t.planId),
    statusIdx: index('posts_status_idx').on(t.status),
    planChannelIdx: uniqueIndex('posts_plan_channel_idx').on(t.planId, t.channelId),
  }),
)

/**
 * Point-in-time metric readings. Kept as a series rather than a single column
 * so you can see whether a post is still climbing or has stalled.
 */
export const metrics = sqliteTable(
  'metrics',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    score: integer('score'),
    comments: integer('comments'),
    views: integer('views'),
    /** "auto" when fetched from a public API, "manual" when you typed it. */
    source: text('source', { enum: ['auto', 'manual'] }).notNull().default('manual'),
    capturedAt: integer('captured_at', { mode: 'timestamp' }).notNull().default(now),
  },
  (t) => ({ postIdx: index('metrics_post_idx').on(t.postId) }),
)

/** Single row, id = 1. Only holds planner preferences now. */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  llmProvider: text('llm_provider').notNull().default('anthropic'),
  llmModel: text('llm_model').notNull().default('claude-sonnet-5'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
})

export const projectsRelations = relations(projects, ({ many }) => ({
  updates: many(updates),
}))
export const updatesRelations = relations(updates, ({ one, many }) => ({
  project: one(projects, { fields: [updates.projectId], references: [projects.id] }),
  plans: many(plans),
}))
export const plansRelations = relations(plans, ({ one, many }) => ({
  update: one(updates, { fields: [plans.updateId], references: [updates.id] }),
  posts: many(posts),
}))
export const postsRelations = relations(posts, ({ one, many }) => ({
  plan: one(plans, { fields: [posts.planId], references: [plans.id] }),
  channel: one(channels, { fields: [posts.channelId], references: [channels.id] }),
  metrics: many(metrics),
}))

export type Project = typeof projects.$inferSelect
export type Update = typeof updates.$inferSelect
export type Channel = typeof channels.$inferSelect
export type Plan = typeof plans.$inferSelect
export type Post = typeof posts.$inferSelect
export type Metric = typeof metrics.$inferSelect
