import { readFileSync } from 'node:fs'
import { runMigrations } from '@/db/migrate'
import { seed } from '@/db/seed'
import { importPlan } from '@/lib/import-plan'

/**
 * Entry point for the Claude skill:
 *   npm run import -- plan.json
 *   cat plan.json | npm run import
 *
 * Self-heals a fresh clone (migrate + seed) so the skill never has to care
 * whether the database exists yet.
 */
function read(): unknown {
  const arg = process.argv[2]
  const raw = arg && arg !== '-' ? readFileSync(arg, 'utf8') : readFileSync(0, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(
      `Could not parse JSON from ${arg ?? 'stdin'}: ${e instanceof Error ? e.message : e}`,
    )
  }
}

try {
  runMigrations()
  seed()
  const r = importPlan(read())

  console.log('')
  console.log(`  ${r.projectCreated ? 'Created' : 'Updated'} project: ${r.projectSlug}`)
  console.log(`  Wrote ${r.postsCreated} post${r.postsCreated === 1 ? '' : 's'}`)
  if (r.skippedChannels.length) {
    console.log(`  Skipped unknown channels: ${r.skippedChannels.join(', ')}`)
  }
  console.log('')
  console.log(`  Open: ${r.url}`)
  console.log('')
  process.exit(0)
} catch (e) {
  if (e && typeof e === 'object' && 'issues' in e) {
    console.error('\n  Plan file failed validation:\n')
    for (const i of (e as { issues: { path: (string | number)[]; message: string }[] }).issues) {
      console.error(`    ${i.path.join('.') || '(root)'}: ${i.message}`)
    }
    console.error('')
  } else {
    console.error(`\n  Import failed: ${e instanceof Error ? e.message : e}\n`)
  }
  process.exit(1)
}
