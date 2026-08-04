import 'server-only'
import { db } from '@/db'
import { settings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateStructured } from '@/llm/generate'
import { GENERATED_PLAN_JSON_SCHEMA, GeneratedPlanSchema } from '@/llm/schema'
import { buildPrompt, SYSTEM_PROMPT } from '@/llm/prompt'
import { apiKeyFor } from '@/env'
import { enabledChannels } from './plans'
import { importPlan } from './import-plan'
import type { PlanFile } from './plan-file'

export function getSettings() {
  return (
    db.select().from(settings).where(eq(settings.id, 1)).get() ??
    db.insert(settings).values({ id: 1 }).returning().get()
  )
}

export type NewProjectInput = PlanFile['project'] & { updateTitle: string; updateBody: string }

/**
 * The built-in planner: same output contract as the Claude skill, so both
 * land in the database through `importPlan`.
 */
export async function generatePlan(input: NewProjectInput) {
  const s = getSettings()
  const apiKey = apiKeyFor(s.llmProvider)
  if (!apiKey) {
    throw new Error(
      `No API key found for ${s.llmProvider}. Set it in your environment, or use the Claude skill instead — that path needs no key.`,
    )
  }

  const projectTags = new Set(input.tags.map((t) => t.toLowerCase()))
  const eligible = enabledChannels().filter(
    (c) => c.requiresTags.length === 0 || c.requiresTags.some((t) => projectTags.has(t.toLowerCase())),
  )

  const { data } = await generateStructured(
    {
      provider: s.llmProvider,
      model: s.llmModel,
      apiKey,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt({
        project: input,
        update: { title: input.updateTitle, body: input.updateBody, kind: 'launch' },
        channels: eligible,
      }),
      jsonSchema: GENERATED_PLAN_JSON_SCHEMA as unknown as Record<string, unknown>,
    },
    GeneratedPlanSchema,
  )

  return importPlan({
    project: input,
    update: { kind: 'launch', title: input.updateTitle, body: input.updateBody, version: null },
    plan: {
      source: s.llmProvider,
      model: s.llmModel,
      strategyMemo: data.strategyMemo,
      positioning: data.positioning,
      openSource: data.openSource,
      assetChecklist: data.assetChecklist,
    },
    posts: data.posts,
  } satisfies PlanFile)
}
