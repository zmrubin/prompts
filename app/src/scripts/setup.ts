import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { runMigrations } from '@/db/migrate'
import { seed } from '@/db/seed'
import { DB_PATH } from '@/db'

/**
 * One-time setup. After this, you never run anything again — Claude Code
 * launches the MCP server itself whenever you open it.
 *
 *   npm run setup
 */
const ROOT = resolve(import.meta.dirname, '../..')
const entry = resolve(ROOT, 'src/mcp/server.ts')
const tsx = resolve(ROOT, 'node_modules/.bin/tsx')

console.log('\n  Preparing the database…')
runMigrations()
const n = seed()
console.log(`  ${n} venues ready at ${DB_PATH}`)

console.log('\n  Registering the MCP server with Claude Code…')
try {
  // User scope so it is available in every Claude Code session, not just this
  // directory — you will want to talk to it from wherever the project lives.
  execFileSync(
    'claude',
    ['mcp', 'add', '--scope', 'user', '--transport', 'stdio', 'pr-agent', '--', tsx, entry],
    { stdio: 'inherit' },
  )
  console.log('\n  Done. Open Claude Code and try:')
  console.log('    "what should I post today?"')
  console.log('    "I just shipped <project> — help me launch it"\n')
} catch {
  console.log('\n  Could not run the `claude` CLI automatically.')
  console.log('  Register it by hand with:\n')
  console.log(
    `    claude mcp add --scope user --transport stdio pr-agent -- ${tsx} ${entry}\n`,
  )
  console.log('  Or, for Claude Desktop, add this to claude_desktop_config.json:\n')
  console.log(
    JSON.stringify(
      { mcpServers: { 'pr-agent': { command: tsx, args: [entry] } } },
      null,
      2,
    ) + '\n',
  )
}
