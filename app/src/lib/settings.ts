import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { settings } from '@/db/schema'
import { decryptJson, encryptJson } from './crypto'
import { env } from '@/env'

export type LlmKeys = Partial<Record<string, string>>

export async function getSettings() {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)
  if (rows[0]) return rows[0]
  const created = await db.insert(settings).values({ id: 1 }).returning()
  return created[0]
}

export async function getLlmKeys(): Promise<LlmKeys> {
  const s = await getSettings()
  if (!s.llmKeysEncrypted) return {}
  try {
    return decryptJson<LlmKeys>(s.llmKeysEncrypted)
  } catch {
    // A key rotation invalidates the blob; treat it as absent rather than
    // taking the whole settings page down.
    return {}
  }
}

export async function setLlmKey(provider: string, key: string | null) {
  const keys = await getLlmKeys()
  if (key) keys[provider] = key
  else delete keys[provider]
  await db
    .update(settings)
    .set({ llmKeysEncrypted: encryptJson(keys), updatedAt: new Date() })
    .where(eq(settings.id, 1))
}

/**
 * The env var is a hard override. If DRY_RUN is set in Railway, no dashboard
 * toggle can turn real posting on — that asymmetry is deliberate.
 */
export async function isDryRun(): Promise<boolean> {
  if (env().DRY_RUN) return true
  const s = await getSettings()
  return s.dryRun
}
