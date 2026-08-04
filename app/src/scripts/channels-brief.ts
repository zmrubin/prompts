import { asc } from 'drizzle-orm'
import { runMigrations } from '@/db/migrate'
import { seed } from '@/db/seed'
import { db } from '@/db'
import { channels, projects } from '@/db/schema'

/**
 * Prints the venue catalog as a briefing for whoever is writing the plan —
 * the Claude skill reads this so its copy respects the real limits and rules
 * instead of guessing at them.
 *
 *   npm run channels            # human-readable
 *   npm run channels -- --json  # machine-readable
 */
runMigrations()
seed()

const rows = db.select().from(channels).orderBy(asc(channels.sortOrder)).all()
const enabled = rows.filter((c) => c.enabled)

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        channels: enabled.map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          charLimit: c.charLimit,
          titleCharLimit: c.titleCharLimit,
          linkPolicy: c.linkPolicy,
          requiresImage: c.requiresImage,
          requiresTags: c.requiresTags,
          audience: c.audience,
          postingRules: c.postingRules,
          bestTime: c.bestTime,
        })),
        existingProjects: db
          .select({ slug: projects.slug, name: projects.name })
          .from(projects)
          .all(),
      },
      null,
      2,
    ),
  )
} else {
  for (const c of enabled) {
    const bits = [
      c.charLimit ? `body ≤${c.charLimit}` : null,
      c.titleCharLimit ? `title ≤${c.titleCharLimit}` : null,
      c.linkPolicy !== 'fine' ? `link: ${c.linkPolicy}` : null,
      c.requiresImage ? 'image required' : null,
      c.requiresTags.length ? `only for: ${c.requiresTags.join('/')}` : null,
    ].filter(Boolean)
    console.log(`\n${c.id}  —  ${c.name}${bits.length ? `  [${bits.join(', ')}]` : ''}`)
    if (c.audience) console.log(`  audience: ${c.audience}`)
    if (c.postingRules) console.log(`  rules: ${c.postingRules}`)
  }
  console.log(`\n${enabled.length} enabled channels.\n`)
}
