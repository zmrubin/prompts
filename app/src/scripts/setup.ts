import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { runMigrations } from '@/db/migrate'
import { seed } from '@/db/seed'
import { DB_PATH } from '@/db'
import { baseUrl } from '@/lib/config'

/**
 * Prepares a local checkout and prints how to register the server.
 *
 *   npm run setup
 *
 * This used to copy a skill into ~/.claude and register a stdio server there.
 * Both die with the machine — and in Claude Code on the web, with the
 * container — which is exactly why the tool kept disappearing from other
 * sessions. Registration is now a hosted URL you add once, so this script
 * tells you what to run rather than writing to your home directory.
 */
const ROOT = resolve(import.meta.dirname, '../..')
const ENTRY = resolve(ROOT, 'src/mcp/server.ts')
/**
 * tsx resolves tsconfig `paths` relative to the working directory, and Claude
 * Code launches this from wherever the user happens to be — so the `@/` alias
 * has to be pinned to an absolute tsconfig or none of the imports resolve.
 */
const TSCONFIG = resolve(ROOT, 'tsconfig.json')
const TSX = resolve(ROOT, 'node_modules/.bin/tsx')

function haveClaudeCli(): boolean {
  try {
    execFileSync('command', ['-v', 'claude'], { stdio: 'ignore', shell: '/bin/sh' })
    return true
  } catch {
    return false
  }
}

console.log('\n  PR Agent — setup\n')

runMigrations()
const n = seed()
console.log(`  ✓ Database ready — ${n} venues at ${DB_PATH}`)

const url = process.env.APP_URL ? `${process.env.APP_URL}/api/mcp` : 'https://<your-app>/api/mcp'
const token = '<MCP_TOKEN>'

console.log('\n  ── To reach this from every Claude session ──────────────────\n')
console.log('  Deploy it, then register the URL once. See app/DEPLOY.md.')
console.log('  A hosted server is the only setup that survives a new machine,')
console.log('  a different repo, or a Claude Code web container.\n')

console.log('  claude.ai — Settings → Connectors → Add custom connector')
console.log(`    URL:     ${url}`)
console.log(`    Header:  Authorization: Bearer ${token}`)
console.log('    Covers Claude web, Desktop, mobile and Claude Code web.\n')

console.log('  Claude Code CLI — every project on this machine:')
console.log('    claude mcp add --transport http --scope user pr-agent \\')
console.log(`      ${url} \\`)
console.log(`      --header "Authorization: Bearer ${token}"\n`)

console.log('  ── Local development only ──────────────────────────────────\n')
console.log('  To point Claude Code at this checkout instead of the deploy:')
console.log(
  `    claude mcp add --scope user --transport stdio pr-agent-local -- ${TSX} --tsconfig ${TSCONFIG} ${ENTRY}\n`,
)

if (!haveClaudeCli()) {
  console.log('  ! The `claude` CLI is not on your PATH — use the claude.ai route above.\n')
}

console.log(`  Dashboard: ${baseUrl()}`)
console.log('  Start it with: npm run dev\n')
