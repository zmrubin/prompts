import { oneShotDb } from './index'
import { channels, settings } from './schema'
import { CHANNEL_SEED } from './channels'

/**
 * Idempotent. Re-running updates the catalog in place so edits to
 * channels.ts (posting rules especially) propagate on the next deploy
 * without clobbering the `enabled` flag you toggled in the UI.
 */
async function main() {
  const { db, close } = oneShotDb()

  for (const c of CHANNEL_SEED) {
    await db
      .insert(channels)
      .values(c)
      .onConflictDoUpdate({
        target: channels.id,
        set: {
          name: c.name,
          category: c.category,
          automation: c.automation,
          connectorKey: c.connectorKey ?? null,
          submitUrlTemplate: c.submitUrlTemplate ?? null,
          homepageUrl: c.homepageUrl ?? null,
          charLimit: c.charLimit ?? null,
          supportsImages: c.supportsImages ?? true,
          requiresImage: c.requiresImage ?? false,
          linkPolicy: c.linkPolicy ?? 'fine',
          audience: c.audience ?? null,
          postingRules: c.postingRules ?? null,
          bestTime: c.bestTime ?? null,
          requiresTags: c.requiresTags ?? [],
          minSpacingMinutes: c.minSpacingMinutes ?? 60,
          sortOrder: c.sortOrder ?? 100,
          // deliberately not touching `enabled`
        },
      })
  }

  await db.insert(settings).values({ id: 1 }).onConflictDoNothing()

  console.log(`Seeded ${CHANNEL_SEED.length} channels.`)
  await close()
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  },
)
