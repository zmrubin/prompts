import { randomBytes, scryptSync } from 'node:crypto'

/**
 * Generates the three secrets Railway needs. Run once:
 *   npm run hash-password -- 'your-password'
 *
 * Deliberately does not import @/lib/crypto — that module validates the full
 * environment, and you run this script precisely because you don't have one yet.
 */
const password = process.argv[2]
if (!password) {
  console.error("Usage: npm run hash-password -- 'your-password'")
  process.exit(1)
}

const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64)

console.log('\nAdd these to Railway environment variables:\n')
console.log(
  `ADMIN_PASSWORD_HASH=scrypt:${salt.toString('base64')}:${hash.toString('base64')}`,
)
console.log(`SESSION_SECRET=${randomBytes(32).toString('base64')}`)
console.log(`ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`)
console.log(
  '\nENCRYPTION_KEY decrypts every stored credential. Losing it means reconnecting every account; rotating it invalidates them all.\n',
)
