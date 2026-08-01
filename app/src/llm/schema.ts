import { z } from 'zod'

export const LaunchPlanSchema = z.object({
  strategyMemo: z
    .string()
    .describe(
      'Markdown. Your honest read on this release: what the angle is, who will care, what the risk is, and what you would do first. 200-400 words. Be specific and opinionated, not generic marketing advice.',
    ),
  positioning: z.object({
    oneLiner: z
      .string()
      .describe('One sentence, under 100 characters, saying what this does. No hype.'),
    audience: z.string().describe('Who specifically should care, and why.'),
    differentiator: z.string().describe('What makes this different from the obvious alternative.'),
  }),
  openSource: z.object({
    recommendation: z.enum(['open-source', 'keep-closed', 'partial']),
    reasoning: z
      .string()
      .describe(
        'Why. Weigh distribution benefit against commercial risk. "partial" means open-sourcing a library or component while keeping the product closed.',
      ),
    confidence: z.enum(['low', 'medium', 'high']),
  }),
  channelPicks: z
    .array(
      z.object({
        channelId: z.string().describe('Must exactly match an id from the channel list.'),
        priority: z.enum(['must', 'should', 'optional']),
        rationale: z.string().describe('One sentence on why this channel fits this release.'),
        suggestedOffsetHours: z
          .number()
          .describe(
            'Hours after the launch moment to post. 0 = immediately. Stagger channels; do not put everything at 0.',
          ),
        draft: z.object({
          title: z
            .string()
            .nullable()
            .describe('Required for Reddit, Hacker News and DEV.to. Null where the venue has no title field.'),
          body: z
            .string()
            .describe(
              'The actual post copy, ready to publish. Written in the venue\'s native register. Respect the character limit exactly.',
            ),
          linkPlacement: z.enum(['body', 'first_comment', 'none']),
          imagePrompt: z
            .string()
            .nullable()
            .describe('What visual to pair with this, or null if none is needed.'),
        }),
      }),
    )
    .describe('One entry per channel worth posting to. Skip channels that genuinely do not fit.'),
  assetChecklist: z
    .array(z.string())
    .describe(
      'Concrete things to prepare before launching, e.g. "Product Hunt gallery: 3 images at 1270x760".',
    ),
})

export type LaunchPlanOutput = z.infer<typeof LaunchPlanSchema>

/**
 * Hand-written JSON Schema rather than a zod-to-json-schema dependency.
 * Kept in sync with LaunchPlanSchema above; the Zod parse is the real gate,
 * this is only the hint we give the model.
 */
export const LAUNCH_PLAN_JSON_SCHEMA = {
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
    channelPicks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          priority: { type: 'string', enum: ['must', 'should', 'optional'] },
          rationale: { type: 'string' },
          suggestedOffsetHours: { type: 'number' },
          draft: {
            type: 'object',
            properties: {
              title: { type: ['string', 'null'] },
              body: { type: 'string' },
              linkPlacement: { type: 'string', enum: ['body', 'first_comment', 'none'] },
              imagePrompt: { type: ['string', 'null'] },
            },
            required: ['title', 'body', 'linkPlacement', 'imagePrompt'],
            additionalProperties: false,
          },
        },
        required: ['channelId', 'priority', 'rationale', 'suggestedOffsetHours', 'draft'],
        additionalProperties: false,
      },
    },
    assetChecklist: { type: 'array', items: { type: 'string' } },
  },
  required: ['strategyMemo', 'positioning', 'openSource', 'channelPicks', 'assetChecklist'],
  additionalProperties: false,
} as const
