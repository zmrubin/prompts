import { z } from 'zod'

/**
 * The contract between a plan's author and the dashboard.
 *
 * Two things produce this shape: the Claude skill (which writes a JSON file
 * and shells out to `npm run import`), and the built-in API-key planner. The
 * dashboard neither knows nor cares which one it came from — which is the
 * whole point of having a file format rather than an integration.
 */

export const PostSchema = z.object({
  channelId: z
    .string()
    .describe('Must exactly match a channel id from the catalog, e.g. "reddit:sideproject".'),
  priority: z.enum(['must', 'should', 'optional']),
  rationale: z.string().describe('One sentence: why this venue fits this release.'),
  dayOffset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Days after launch day. 0 = launch day. Stagger these.'),
  title: z.string().nullable().default(null),
  body: z.string().describe('Finished copy, ready to paste, in the venue\'s native voice.'),
  linkPlacement: z.enum(['body', 'first_comment', 'none']).default('body'),
  imagePrompt: z.string().nullable().default(null),
})

export const PlanFileSchema = z.object({
  project: z.object({
    name: z.string(),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and hyphens only')
      .describe('Stable id. Reuse the same slug to add an update to an existing project.'),
    tagline: z.string().nullable().default(null),
    description: z.string().nullable().default(null),
    url: z.string().nullable().default(null),
    repoUrl: z.string().nullable().default(null),
    status: z.enum(['idea', 'building', 'launched', 'archived']).default('launched'),
    tags: z.array(z.string()).default([]),
    techStack: z.array(z.string()).default([]),
    isOpenSource: z.boolean().default(false),
    targetAudience: z.string().nullable().default(null),
  }),
  update: z.object({
    kind: z.enum(['launch', 'feature', 'milestone', 'writeup']).default('launch'),
    title: z.string(),
    body: z.string().describe('The raw notes this plan was written from.'),
    version: z.string().nullable().default(null),
  }),
  plan: z.object({
    source: z.string().default('claude-skill'),
    model: z.string().nullable().default(null),
    strategyMemo: z.string(),
    positioning: z.object({
      oneLiner: z.string(),
      audience: z.string(),
      differentiator: z.string(),
    }),
    openSource: z.object({
      recommendation: z.enum(['open-source', 'keep-closed', 'partial']),
      reasoning: z.string(),
      confidence: z.enum(['low', 'medium', 'high']),
    }),
    assetChecklist: z.array(z.string()).default([]),
  }),
  posts: z.array(PostSchema).min(1),
})

export type PlanFile = z.infer<typeof PlanFileSchema>
