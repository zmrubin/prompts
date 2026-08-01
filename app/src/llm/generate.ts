import type { z } from 'zod'
import { providerOf } from './providers'

export type Usage = { inputTokens?: number; outputTokens?: number }

export type GenerateArgs = {
  provider: string
  model: string
  apiKey: string
  system: string
  prompt: string
  jsonSchema: Record<string, unknown>
  maxTokens?: number
}

type RawResult = { text: string; usage: Usage }

const TOOL_NAME = 'emit_launch_plan'

async function callAnthropic(a: GenerateArgs): Promise<RawResult> {
  const spec = providerOf(a.provider)
  const res = await fetch(`${spec.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': a.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: a.model,
      max_tokens: a.maxTokens ?? 8000,
      system: a.system,
      messages: [{ role: 'user', content: a.prompt }],
      // Forcing a tool call is how we get guaranteed-shaped JSON out of
      // Anthropic rather than parsing prose.
      tools: [
        {
          name: TOOL_NAME,
          description: 'Return the completed launch plan.',
          input_schema: a.jsonSchema,
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    content: { type: string; input?: unknown }[]
    usage?: { input_tokens: number; output_tokens: number }
  }
  const toolUse = data.content.find((c) => c.type === 'tool_use')
  if (!toolUse?.input) throw new Error('Anthropic returned no tool_use block')

  return {
    text: JSON.stringify(toolUse.input),
    usage: {
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    },
  }
}

async function callOpenAICompatible(a: GenerateArgs): Promise<RawResult> {
  const spec = providerOf(a.provider)
  const body: Record<string, unknown> = {
    model: a.model,
    max_tokens: a.maxTokens ?? 8000,
    messages: [
      { role: 'system', content: a.system },
      { role: 'user', content: a.prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'launch_plan', strict: true, schema: a.jsonSchema },
    },
  }

  let res = await fetch(`${spec.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${a.apiKey}` },
    body: JSON.stringify(body),
  })

  // Not every OpenAI-compatible endpoint honours json_schema. Fall back to
  // plain JSON mode, then to raw prose, rather than failing the whole run.
  if (!res.ok && res.status === 400) {
    body.response_format = { type: 'json_object' }
    res = await fetch(`${spec.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${a.apiKey}` },
      body: JSON.stringify(body),
    })
    if (!res.ok && res.status === 400) {
      delete body.response_format
      res = await fetch(`${spec.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${a.apiKey}` },
        body: JSON.stringify(body),
      })
    }
  }

  if (!res.ok) {
    throw new Error(`${spec.name} ${res.status}: ${(await res.text()).slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[]
    usage?: { prompt_tokens: number; completion_tokens: number }
  }
  return {
    text: data.choices[0]?.message?.content ?? '',
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
  }
}

/** Models sometimes wrap JSON in prose or a fenced block. Dig it out. */
function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try {
      return JSON.parse(fenced[1])
    } catch {
      // fall through
    }
  }
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1))
  }
  throw new Error('Model response contained no parseable JSON')
}

/**
 * Calls the model and validates against the Zod schema. On a validation
 * failure it retries once, feeding the specific errors back — which fixes
 * the great majority of near-miss responses without a full regeneration.
 */
export async function generateStructured<T>(
  args: GenerateArgs,
  schema: z.ZodType<T>,
): Promise<{ data: T; usage: Usage; raw: unknown }> {
  const spec = providerOf(args.provider)
  const call = spec.kind === 'anthropic' ? callAnthropic : callOpenAICompatible

  const first = await call(args)
  const firstRaw = extractJson(first.text)
  const firstParse = schema.safeParse(firstRaw)
  if (firstParse.success) {
    return { data: firstParse.data, usage: first.usage, raw: firstRaw }
  }

  const issues = firstParse.error.issues
    .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')

  const repaired = await call({
    ...args,
    prompt: `${args.prompt}

Your previous response failed validation with these errors:
${issues}

Return corrected JSON matching the schema exactly. Output only the JSON.`,
  })

  const repairedRaw = extractJson(repaired.text)
  const parsed = schema.parse(repairedRaw)
  return {
    data: parsed,
    usage: {
      inputTokens: (first.usage.inputTokens ?? 0) + (repaired.usage.inputTokens ?? 0),
      outputTokens: (first.usage.outputTokens ?? 0) + (repaired.usage.outputTokens ?? 0),
    },
    raw: repairedRaw,
  }
}
