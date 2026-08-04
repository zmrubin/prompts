import 'server-only'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { channels, launchPlans, postDrafts, projects, updates } from '@/db/schema'
import { generateStructured } from '@/llm/generate'
import { LAUNCH_PLAN_JSON_SCHEMA, LaunchPlanSchema } from '@/llm/schema'
import { buildPrompt, SYSTEM_PROMPT } from '@/llm/prompt'
import { getLlmKeys, getSettings } from './settings'

/**
 * Runs the LLM over one update and materialises the plan plus a draft per
 * channel. Called from a route handler, not the request path of a page —
 * generation takes tens of seconds.
 */
export async function generateLaunchPlan(updateId: string) {
  const [update] = await db.select().from(updates).where(eq(updates.id, updateId)).limit(1)
  if (!update) throw new Error('Update not found')

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, update.projectId))
    .limit(1)
  if (!project) throw new Error('Project not found')

  const settings = await getSettings()
  const keys = await getLlmKeys()
  const apiKey = keys[settings.llmProvider]
  if (!apiKey) {
    throw new Error(
      `No API key stored for ${settings.llmProvider}. Add one in Settings before generating a plan.`,
    )
  }

  // Only offer channels that are enabled and whose tag gate this project passes.
  const all = await db
    .select()
    .from(channels)
    .where(eq(channels.enabled, true))
    .orderBy(asc(channels.sortOrder))

  const projectTags = new Set(project.tags.map((t) => t.toLowerCase()))
  const eligible = all.filter(
    (c) =>
      c.requiresTags.length === 0 ||
      c.requiresTags.some((t) => projectTags.has(t.toLowerCase())),
  )

  const [plan] = await db
    .insert(launchPlans)
    .values({
      updateId,
      provider: settings.llmProvider,
      model: settings.llmModel,
      status: 'pending',
    })
    .returning()

  try {
    const { data, usage, raw } = await generateStructured(
      {
        provider: settings.llmProvider,
        model: settings.llmModel,
        apiKey,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt({ project, update, channels: eligible }),
        jsonSchema: LAUNCH_PLAN_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
      LaunchPlanSchema,
    )

    // The model occasionally invents a channel id; drop those rather than
    // failing the whole plan on a foreign key violation.
    const validIds = new Set(eligible.map((c) => c.id))
    const picks = data.channelPicks.filter((p) => validIds.has(p.channelId))

    await db
      .update(launchPlans)
      .set({
        status: 'ready',
        strategyMemo: data.strategyMemo,
        positioning: data.positioning,
        openSourceRec: data.openSource,
        assetChecklist: data.assetChecklist,
        rawResponse: raw as object,
        tokenUsage: usage,
      })
      .where(eq(launchPlans.id, plan.id))

    if (picks.length) {
      await db.insert(postDrafts).values(
        picks.map((p) => ({
          launchPlanId: plan.id,
          channelId: p.channelId,
          priority: p.priority,
          title: p.draft.title,
          body: p.draft.body,
          linkUrl: project.url ?? null,
          linkPlacement: p.draft.linkPlacement,
          imagePrompt: p.draft.imagePrompt,
          rationale: p.rationale,
          suggestedOffsetHours: Math.round(p.suggestedOffsetHours),
        })),
      )
    }

    const dropped = data.channelPicks.length - picks.length
    return { planId: plan.id, drafts: picks.length, dropped }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await db
      .update(launchPlans)
      .set({ status: 'failed', error: message })
      .where(eq(launchPlans.id, plan.id))
    throw e
  }
}

export async function getPlanWithDrafts(planId: string) {
  const [plan] = await db
    .select()
    .from(launchPlans)
    .where(eq(launchPlans.id, planId))
    .limit(1)
  if (!plan) return null

  const drafts = await db
    .select()
    .from(postDrafts)
    .where(eq(postDrafts.launchPlanId, planId))

  const ids = drafts.map((d) => d.channelId)
  const chans = ids.length
    ? await db.select().from(channels).where(inArray(channels.id, ids))
    : []
  const byId = new Map(chans.map((c) => [c.id, c]))

  const [update] = await db
    .select()
    .from(updates)
    .where(eq(updates.id, plan.updateId))
    .limit(1)
  const [project] = update
    ? await db.select().from(projects).where(eq(projects.id, update.projectId)).limit(1)
    : []

  const order = { must: 0, should: 1, optional: 2 } as const
  // Postgres returns rows in no guaranteed order, so priority and offset alone
  // leave ties to reshuffle between loads — which moves cards around under the
  // cursor while you are editing them. The channel's own sort order, then its
  // id, makes the list stable.
  drafts.sort(
    (a, b) =>
      order[a.priority] - order[b.priority] ||
      a.suggestedOffsetHours - b.suggestedOffsetHours ||
      (byId.get(a.channelId)?.sortOrder ?? 0) - (byId.get(b.channelId)?.sortOrder ?? 0) ||
      a.channelId.localeCompare(b.channelId),
  )

  return {
    plan,
    project,
    update,
    drafts: drafts.map((d) => ({ draft: d, channel: byId.get(d.channelId)! })),
  }
}

export async function latestPlanForUpdate(updateId: string) {
  const [plan] = await db
    .select()
    .from(launchPlans)
    .where(and(eq(launchPlans.updateId, updateId), eq(launchPlans.status, 'ready')))
    .limit(1)
  return plan ?? null
}
