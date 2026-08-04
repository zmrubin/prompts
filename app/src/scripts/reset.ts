import { db, DB_PATH } from '@/db'
import { metrics, plans, posts, projects, updates } from '@/db/schema'
import { runMigrations } from '@/db/migrate'
import { seed } from '@/db/seed'

/**
 * Wipes your projects and everything under them, leaving the venue catalog
 * and its enabled/disabled toggles intact.
 *
 *   npm run reset            # shows what would go, changes nothing
 *   npm run reset -- --yes   # actually does it
 *
 * The only destructive command in the tool, so it takes two steps on purpose.
 */
runMigrations()

const counts = {
  projects: db.select().from(projects).all().length,
  updates: db.select().from(updates).all().length,
  plans: db.select().from(plans).all().length,
  posts: db.select().from(posts).all().length,
  metrics: db.select().from(metrics).all().length,
}

const names = db.select({ name: projects.name, slug: projects.slug }).from(projects).all()

console.log(`\n  Database: ${DB_PATH}\n`)

if (!counts.projects) {
  console.log('  Nothing to reset — there are no projects.\n')
  process.exit(0)
}

console.log('  This would delete:\n')
for (const p of names) console.log(`    ${p.name}  (${p.slug})`)
console.log('')
console.log(
  `    ${counts.updates} update(s), ${counts.plans} plan(s), ${counts.posts} post(s), ${counts.metrics} metric reading(s)`,
)
console.log('\n  The 29-venue catalog and your enabled/disabled toggles are kept.\n')

if (!process.argv.includes('--yes')) {
  console.log('  Nothing changed. Re-run with --yes to go ahead:\n')
  console.log('    npm run reset -- --yes\n')
  process.exit(0)
}

// Cascades handle updates -> plans -> posts -> metrics, but be explicit so
// this still holds if a foreign key is ever relaxed.
db.delete(metrics).run()
db.delete(posts).run()
db.delete(plans).run()
db.delete(updates).run()
db.delete(projects).run()

const venues = seed()
console.log(`  Done. ${venues} venues intact, projects cleared.\n`)
