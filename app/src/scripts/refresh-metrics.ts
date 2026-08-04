import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { channels, posts } from '@/db/schema'
import { refreshMetrics } from '@/lib/metrics'
import { runMigrations } from '@/db/migrate'

/** Re-reads public stats for everything posted with a URL. Safe to cron. */
async function main() {
  runMigrations()
  const rows = db.select().from(posts).where(eq(posts.status, 'posted')).all()
  const chans = new Map(db.select().from(channels).all().map((c) => [c.id, c]))
  let ok = 0
  for (const p of rows) {
    const c = chans.get(p.channelId)
    if (!p.postedUrl || !c?.metricsSource) continue
    const r = await refreshMetrics(p.id, c.metricsSource, p.postedUrl)
    if (r.error) console.log(`  ${c.name}: ${r.error}`)
    else {
      ok++
      console.log(`  ${c.name}: ${r.score ?? '?'} pts, ${r.comments ?? '?'} comments`)
    }
  }
  console.log(`\n  Refreshed ${ok} post${ok === 1 ? '' : 's'}.`)
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
