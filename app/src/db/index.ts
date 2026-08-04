import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as schema from './schema'

/**
 * Anchored to the app root rather than the working directory: the MCP server
 * is launched by Claude Code from wherever it happens to be, and a relative
 * default would silently create a fresh empty database per directory.
 *
 * Override with PRAGENT_DB to keep it outside the repo.
 */
const APP_ROOT = resolve(import.meta.dirname, '../..')
const DB_PATH = process.env.PRAGENT_DB
  ? resolve(process.env.PRAGENT_DB)
  : resolve(APP_ROOT, 'data/pragent.db')

declare global {
  // eslint-disable-next-line no-var
  var __pragentDb: Database.Database | undefined
}

function connection() {
  if (!globalThis.__pragentDb) {
    mkdirSync(dirname(DB_PATH), { recursive: true })
    const sqlite = new Database(DB_PATH)
    // WAL lets the dashboard read while the import CLI writes.
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    globalThis.__pragentDb = sqlite
  }
  return globalThis.__pragentDb
}

export const db = drizzle(connection(), { schema })
export { schema, DB_PATH }
