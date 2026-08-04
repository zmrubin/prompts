import { z } from 'zod'

/**
 * What the built-in planner asks the model for. Deliberately the same shape
 * as the `plan` + `posts` halves of a plan file, so both authoring paths
 * converge on one importer.
 */
export const GeneratedPlanSchema = z.object({
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
  assetChecklist: z.array(z.string()),
  posts: z.array(
    z.object({
      channelId: z.string(),
      priority: z.enum(['must', 'should', 'optional']),
      rationale: z.string(),
      dayOffset: z.number(),
      title: z.string().nullable(),
      body: z.string(),
      linkPlacement: z.enum(['body', 'first_comment', 'none']),
      imagePrompt: z.string().nullable(),
    }),
  ),
})

export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>

export const GENERATED_PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    strategyMemo: { type: 'string' },
    positioning: {
      type: 'object',
      properties: {
        oneLiner: { type: 'string' },
        audience: { type: 'string' },
        differentiator: { type: 'string' },
      },
      required: ['oneLiner', 'audience', 'differentiator'],
      additionalProperties: false,
    },
    openSource: {
      type: 'object',
      properties: {
        recommendation: { type: 'string', enum: ['open-source', 'keep-closed', 'partial'] },
        reasoning: { type: 'string' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['recommendation', 'reasoning', 'confidence'],
      additionalProperties: false,
    },
    assetChecklist: { type: 'array', items: { type: 'string' } },
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          priority: { type: 'string', enum: ['must', 'should', 'optional'] },
          rationale: { type: 'string' },
          dayOffset: { type: 'number' },
          title: { type: ['string', 'null'] },
          body: { type: 'string' },
          linkPlacement: { type: 'string', enum: ['body', 'first_comment', 'none'] },
          imagePrompt: { type: ['string', 'null'] },
        },
        required: [
          'channelId',
          'priority',
          'rationale',
          'dayOffset',
          'title',
          'body',
          'linkPlacement',
          'imagePrompt',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['strategyMemo', 'positioning', 'openSource', 'assetChecklist', 'posts'],
  additionalProperties: false,
} as const
