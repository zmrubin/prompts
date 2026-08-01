import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { oneShotDb } from './index'

async function main() {
  const { db, close } = oneShotDb()
  console.log('Running migrations…')
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations complete.')
  await close()
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  },
)
