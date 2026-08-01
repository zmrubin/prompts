import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const projectStatus = pgEnum('project_status', [
  'idea',
  'building',
  'launched',
  'archived',
])

export const updateKind = pgEnum('update_kind', [
  'launch',
  'feature',
  'milestone',
  'writeup',
])

export const channelCategory = pgEnum('channel_category', [
  'social',
  'launch_platform',
  'directory',
  'reddit',
  'dev_content',
  'community',
])

/**
 * How a channel gets posted to:
 *  - auto:   we have a working, free, no-approval API today
 *  - gated:  an API exists but needs money or a manual approval queue
 *  - manual: no write path exists; we prep copy and deep-link the submit form
 */
export const channelAutomation = pgEnum('channel_automation', [
  'auto',
  'gated',
  'manual',
])

/**
 * How the venue treats an outbound link. Drives both the LLM prompt and the
 * draft validator, so copy never gets written in a way the venue punishes.
 */
export const linkPolicy = pgEnum('link_policy', [
  'fine',
  'penalized',
  'first_comment',
  'not_clickable',
])

export const planStatus = pgEnum('plan_status', ['pending', 'ready', 'failed'])

export const scheduledStatus = pgEnum('scheduled_status', [
  'scheduled',
  'processing',
  'posted',
  'failed',
  'skipped',
  'manual_pending',
  'manual_done',
])

export const connectionStatus = pgEnum('connection_status', [
  'connected',
  'needs_reauth',
  'disconnected',
])

export const priority = pgEnum('priority', ['must', 'should', 'optional'])

export const linkPlacement = pgEnum('link_placement', [
  'body',
  'first_comment',
  'none',
])

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  tagline: text('tagline'),
  description: text('description'),
  url: text('url'),
  repoUrl: text('repo_url'),
  status: projectStatus('status').notNull().default('building'),
  tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
  isOpenSource: boolean('is_open_source').notNull().default(false),
  techStack: text('tech_stack').array().notNull().default(sql`ARRAY[]::text[]`),
  targetAudience: text('target_audience'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const updates = pgTable(
  'updates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: updateKind('kind').notNull().default('feature'),
    title: text('title').notNull(),
    /** Your raw notes on what's new. The LLM turns this into copy. */
    body: text('body').notNull(),
    version: text('version'),
    mediaUrls: text('media_urls').array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('updates_project_idx').on(t.projectId)],
)

/**
 * The seeded catalog of every place a project can be posted. Rules live here
 * rather than in code so one row feeds the LLM prompt, the draft validator,
 * and the UI simultaneously.
 */
export const channels = pgTable('channels', {
  /** Slug PK, e.g. "bluesky" or "reddit:sideproject". */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: channelCategory('category').notNull(),
  automation: channelAutomation('automation').notNull(),
  /** Which connector implements this channel. Null for pure-manual venues. */
  connectorKey: text('connector_key'),
  /** For manual venues: submit URL with {url} and {title} placeholders. */
  submitUrlTemplate: text('submit_url_template'),
  homepageUrl: text('homepage_url'),
  charLimit: integer('char_limit'),
  supportsImages: boolean('supports_images').notNull().default(true),
  requiresImage: boolean('requires_image').notNull().default(false),
  linkPolicy: linkPolicy('link_policy').notNull().default('fine'),
  audience: text('audience'),
  /** Free text fed verbatim to the LLM: self-promo rules, tone, format. */
  postingRules: text('posting_rules'),
  bestTime: text('best_time'),
  /** Only suggest this channel when the project carries one of these tags. */
  requiresTags: text('requires_tags').array().notNull().default(sql`ARRAY[]::text[]`),
  /** Minutes to leave between two posts to this same channel. */
  minSpacingMinutes: integer('min_spacing_minutes').notNull().default(60),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(100),
})

export const launchPlans = pgTable(
  'launch_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    updateId: uuid('update_id')
      .notNull()
      .references(() => updates.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    status: planStatus('status').notNull().default('pending'),
    strategyMemo: text('strategy_memo'),
    positioning: jsonb('positioning'),
    openSourceRec: jsonb('open_source_rec'),
    assetChecklist: text('asset_checklist').array().notNull().default(sql`ARRAY[]::text[]`),
    rawResponse: jsonb('raw_response'),
    tokenUsage: jsonb('token_usage'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('launch_plans_update_idx').on(t.updateId)],
)

export const postDrafts = pgTable(
  'post_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    launchPlanId: uuid('launch_plan_id')
      .notNull()
      .references(() => launchPlans.id, { onDelete: 'cascade' }),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id),
    priority: priority('priority').notNull().default('should'),
    title: text('title'),
    body: text('body').notNull(),
    linkUrl: text('link_url'),
    linkPlacement: linkPlacement('link_placement').notNull().default('body'),
    imagePrompt: text('image_prompt'),
    /** Why the model chose this framing — shown in the review UI. */
    rationale: text('rationale'),
    suggestedOffsetHours: integer('suggested_offset_hours').notNull().default(0),
    approved: boolean('approved').notNull().default(false),
    editedByUser: boolean('edited_by_user').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('post_drafts_plan_idx').on(t.launchPlanId)],
)

export const scheduledPosts = pgTable(
  'scheduled_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postDraftId: uuid('post_draft_id')
      .notNull()
      .references(() => postDrafts.id, { onDelete: 'cascade' }),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    status: scheduledStatus('status').notNull().default('scheduled'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    externalId: text('external_id'),
    externalUrl: text('external_url'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    /** hash(draftId + scheduledFor) — the double-post guard. */
    idempotencyKey: text('idempotency_key').notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('scheduled_posts_idempotency_idx').on(t.idempotencyKey),
    index('scheduled_posts_due_idx').on(t.status, t.scheduledFor),
  ],
)

export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectorKey: text('connector_key').notNull().unique(),
  displayName: text('display_name'),
  /** AES-256-GCM blob. Never returned to the client. */
  credentialsEncrypted: text('credentials_encrypted').notNull(),
  /** Non-secret metadata only: handle, instance URL, account id. */
  meta: jsonb('meta'),
  status: connectionStatus('status').notNull().default('connected'),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduledPostId: uuid('scheduled_post_id').references(() => scheduledPosts.id, {
      onDelete: 'cascade',
    }),
    event: text('event').notNull(),
    detail: jsonb('detail'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('events_scheduled_idx').on(t.scheduledPostId)],
)

/** Single-row table. Always id = 1. */
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  llmProvider: text('llm_provider').notNull().default('anthropic'),
  llmModel: text('llm_model').notNull().default('claude-sonnet-5'),
  /** AES-256-GCM blob: { anthropic?: string, kimi?: string, ... } */
  llmKeysEncrypted: text('llm_keys_encrypted'),
  timezone: text('timezone').notNull().default('America/New_York'),
  /** Master safety switch. Connectors log instead of posting while true. */
  dryRun: boolean('dry_run').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const projectsRelations = relations(projects, ({ many }) => ({
  updates: many(updates),
}))

export const updatesRelations = relations(updates, ({ one, many }) => ({
  project: one(projects, { fields: [updates.projectId], references: [projects.id] }),
  launchPlans: many(launchPlans),
}))

export const launchPlansRelations = relations(launchPlans, ({ one, many }) => ({
  update: one(updates, { fields: [launchPlans.updateId], references: [updates.id] }),
  drafts: many(postDrafts),
}))

export const postDraftsRelations = relations(postDrafts, ({ one, many }) => ({
  launchPlan: one(launchPlans, {
    fields: [postDrafts.launchPlanId],
    references: [launchPlans.id],
  }),
  channel: one(channels, { fields: [postDrafts.channelId], references: [channels.id] }),
  scheduled: many(scheduledPosts),
}))

export const scheduledPostsRelations = relations(scheduledPosts, ({ one, many }) => ({
  draft: one(postDrafts, {
    fields: [scheduledPosts.postDraftId],
    references: [postDrafts.id],
  }),
  channel: one(channels, {
    fields: [scheduledPosts.channelId],
    references: [channels.id],
  }),
  events: many(events),
}))

export type Project = typeof projects.$inferSelect
export type Update = typeof updates.$inferSelect
export type Channel = typeof channels.$inferSelect
export type LaunchPlan = typeof launchPlans.$inferSelect
export type PostDraft = typeof postDrafts.$inferSelect
export type ScheduledPost = typeof scheduledPosts.$inferSelect
export type Connection = typeof connections.$inferSelect
export type Settings = typeof settings.$inferSelect
