import { db } from './index'
import { channels, settings } from './schema'
import { CHANNEL_SEED } from './channels'
import { runMigrations } from './migrate'

/**
 * Idempotent. Re-running refreshes the catalog in place so edits to
 * channels.ts propagate, while leaving your `enabled` toggles alone.
 */
export function seed() {
  for (const c of CHANNEL_SEED) {
    db.insert(channels)
      .values(c)
      .onConflictDoUpdate({
        target: channels.id,
        set: {
          name: c.name,
          category: c.category,
          submitUrlTemplate: c.submitUrlTemplate ?? null,
          homepageUrl: c.homepageUrl ?? null,
          charLimit: c.charLimit ?? null,
          titleCharLimit: c.titleCharLimit ?? null,
          requiresImage: c.requiresImage ?? false,
          linkPolicy: c.linkPolicy ?? 'fine',
          audience: c.audience ?? null,
          postingRules: c.postingRules ?? null,
          bestTime: c.bestTime ?? null,
          requiresTags: c.requiresTags ?? [],
          metricsSource: c.metricsSource ?? null,
          sortOrder: c.sortOrder ?? 100,
          // `enabled` deliberately untouched.
        },
      })
      .run()
  }
  db.insert(settings).values({ id: 1 }).onConflictDoNothing().run()
  return CHANNEL_SEED.length
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runMigrations()
  console.log(`Seeded ${seed()} channels.`)
}
