import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/env'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __prAgentSql: ReturnType<typeof postgres> | undefined
}

function client() {
  // Reuse across HMR reloads in dev so we don't exhaust Postgres connections.
  if (!globalThis.__prAgentSql) {
    globalThis.__prAgentSql = postgres(env().DATABASE_URL, {
      max: 10,
      // Railway Postgres terminates idle connections; keep the pool honest.
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }
  return globalThis.__prAgentSql
}

export const db = drizzle(client(), { schema })
export { schema }

/**
 * A one-shot connection for scripts that must exit cleanly (migrations, seed,
 * the Railway cron scheduler). The long-lived pool above would keep the
 * process alive and Railway would eventually kill the container.
 */
export function oneShotDb() {
  const sql = postgres(env().DATABASE_URL, { max: 1, connect_timeout: 10 })
  return { db: drizzle(sql, { schema }), close: () => sql.end({ timeout: 5 }) }
}
