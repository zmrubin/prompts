import { randomBytes } from 'node:crypto'
import { hashPassword } from '@/lib/auth'

/**
 * Generates the two secrets a hosted deploy needs.
 *
 *   npm run hash-password -- "your password here"
 *
 * Prints them as environment variables ready to paste into Railway.
 */
const password = process.argv.slice(2).filter((a) => a !== '--').join(' ').trim()

if (!password) {
  console.error('\n  Usage: npm run hash-password -- "your password here"\n')
  process.exit(1)
}

if (password.length < 12) {
  console.error(
    `\n  That password is ${password.length} characters. This dashboard sits on the public internet — use at least 12.\n`,
  )
  process.exit(1)
}

console.log('\n  Set these on your host:\n')
console.log(`  ADMIN_PASSWORD_HASH=${hashPassword(password)}`)
console.log(`  SESSION_SECRET=${randomBytes(32).toString('base64')}`)
console.log(`  MCP_TOKEN=${randomBytes(32).toString('base64url')}`)
console.log(
  '\n  MCP_TOKEN is the bearer token you give the Claude connector. Treat it like a password.\n',
)
