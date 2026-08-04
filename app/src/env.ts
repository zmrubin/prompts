/**
 * There is no required configuration. The app runs on localhost against a
 * local SQLite file, with no login and no stored credentials.
 *
 * Everything below is optional: set an API key only if you want the built-in
 * planner. The Claude skill path needs none of it.
 */
export const env = {
  /** Where the SQLite file lives. Defaults to ./data/pragent.db */
  dbPath: process.env.PRAGENT_DB,
  keys: {
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    kimi: process.env.MOONSHOT_API_KEY,
    qwen: process.env.DASHSCOPE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  } as Record<string, string | undefined>,
}

export function apiKeyFor(provider: string): string | undefined {
  return env.keys[provider]
}

export function providersWithKeys(): string[] {
  return Object.entries(env.keys)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k)
}
