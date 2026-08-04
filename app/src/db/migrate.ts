import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db, DB_PATH } from './index'

/**
 * Idempotent. Safe to run on every `npm run dev` — that is how the app
 * self-heals a fresh clone with no setup step.
 */
export function runMigrations() {
  migrate(db, { migrationsFolder: 'drizzle' })
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
  console.log(`Database ready at ${DB_PATH}`)
}
