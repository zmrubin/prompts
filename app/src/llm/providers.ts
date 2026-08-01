export type ProviderId = 'anthropic' | 'gemini' | 'kimi' | 'qwen' | 'openai'

export type ProviderSpec = {
  id: ProviderId
  name: string
  /** Anthropic uses its own Messages API; everything else is OpenAI-shaped. */
  kind: 'anthropic' | 'openai-compatible'
  baseUrl: string
  models: { id: string; label: string; note?: string }[]
  keyUrl: string
  costNote: string
}

/**
 * Kimi, Qwen and Gemini all expose an OpenAI-compatible /chat/completions
 * endpoint, so one adapter covers three providers — only the base URL and
 * model names differ.
 */
export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    costNote: 'Paid. Best copy quality of the options here.',
    models: [
      { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Strongest, most expensive' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Best balance — recommended' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', note: 'Fast and cheap' },
    ],
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/apikey',
    costNote: 'Generous free tier — roughly 15 requests/min, 1,500/day.',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Free tier, fast' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'Better reasoning' },
    ],
  },
  kimi: {
    id: 'kimi',
    name: 'Moonshot Kimi',
    kind: 'openai-compatible',
    baseUrl: 'https://api.moonshot.ai/v1',
    keyUrl: 'https://platform.moonshot.ai',
    costNote: 'Cheap. Strong long-context writing.',
    models: [
      { id: 'kimi-k2-0711-preview', label: 'Kimi K2' },
      { id: 'moonshot-v1-32k', label: 'Moonshot v1 32k' },
    ],
  },
  qwen: {
    id: 'qwen',
    name: 'Alibaba Qwen',
    kind: 'openai-compatible',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    keyUrl: 'https://bailian.console.alibabacloud.com',
    costNote: 'Cheap, with a free quota on DashScope.',
    models: [
      { id: 'qwen-plus', label: 'Qwen Plus' },
      { id: 'qwen-max', label: 'Qwen Max' },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    costNote: 'Paid.',
    models: [
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    ],
  },
}

export function providerOf(id: string): ProviderSpec {
  return PROVIDERS[id as ProviderId] ?? PROVIDERS.anthropic
}
