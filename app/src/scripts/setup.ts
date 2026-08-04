import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { runMigrations } from '@/db/migrate'
import { seed } from '@/db/seed'
import { DB_PATH } from '@/db'
import { baseUrl } from '@/lib/config'

/**
 * One-time setup. After this you never run anything again — Claude Code
 * launches the MCP server itself whenever you open it.
 *
 *   npm run setup
 *
 * Safe to re-run: registration is removed and re-added rather than
 * duplicated, and the database is migrated in place.
 */
const ROOT = resolve(import.meta.dirname, '../..')
const ENTRY = resolve(ROOT, 'src/mcp/server.ts')
const TSX = resolve(ROOT, 'node_modules/.bin/tsx')
/**
 * tsx resolves tsconfig `paths` relative to the working directory, and Claude
 * Code launches this from wherever the user happens to be — so the `@/` alias
 * has to be pinned to an absolute tsconfig or none of the imports resolve.
 */
const TSCONFIG = resolve(ROOT, 'tsconfig.json')
const ARGS = ['--tsconfig', TSCONFIG, ENTRY]
const NAME = 'pr-agent'

const ok = (m: string) => console.log(`  ✓ ${m}`)
const warn = (m: string) => console.log(`  ! ${m}`)

function haveClaudeCli(): boolean {
  try {
    execFileSync('command', ['-v', 'claude'], { stdio: 'ignore', shell: '/bin/sh' })
    return true
  } catch {
    return false
  }
}

function registerWithClaudeCode(): boolean {
  // Remove first so re-running updates the path instead of erroring on a
  // duplicate name.
  try {
    execFileSync('claude', ['mcp', 'remove', '--scope', 'user', NAME], { stdio: 'ignore' })
  } catch {
    // Not registered yet, which is the normal first-run case.
  }

  try {
    execFileSync(
      'claude',
      ['mcp', 'add', '--scope', 'user', '--transport', 'stdio', NAME, '--', TSX, ...ARGS],
      { stdio: 'inherit' },
    )
  } catch {
    return false
  }

  // Trust the listing, not the exit code.
  try {
    const list = execFileSync('claude', ['mcp', 'list'], { encoding: 'utf8' })
    if (!list.includes(NAME)) {
      warn('`claude mcp add` reported success but the server is not in `claude mcp list`.')
      return false
    }
  } catch {
    warn('Could not verify with `claude mcp list` — check it yourself.')
  }
  return true
}

/** Claude Desktop reads a JSON config rather than using the CLI. */
function desktopConfigPath(): string | null {
  const os = platform()
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  }
  if (os === 'linux') return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json')
  if (os === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json')
  }
  return null
}

function registerWithClaudeDesktop(): boolean {
  const path = desktopConfigPath()
  if (!path) return false

  let config: { mcpServers?: Record<string, unknown> } = {}
  if (existsSync(path)) {
    try {
      config = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      warn(`${path} exists but is not valid JSON — leaving it alone.`)
      return false
    }
  } else if (!existsSync(dirname(path))) {
    // Claude Desktop isn't installed; don't invent its config directory.
    return false
  }

  config.mcpServers = { ...config.mcpServers, [NAME]: { command: TSX, args: ARGS } }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
  ok(`Registered with Claude Desktop (${path})`)
  console.log('    Restart Claude Desktop for it to pick this up.')
  return true
}

/**
 * The MCP server carries the data and the actions; the skill carries the
 * writing judgement. Installed to ~/.claude/skills so it applies in every
 * session, not only when your working directory happens to be this repo.
 */
function installSkill(): boolean {
  const from = resolve(ROOT, '..', '.claude', 'skills', 'launch-plan')
  if (!existsSync(from)) {
    warn(`Skill not found at ${from} — the MCP tools will work, but without the writing guidance.`)
    return false
  }
  const to = join(homedir(), '.claude', 'skills', 'launch-plan')
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true })
  ok(`Skill installed (${to})`)
  return true
}

console.log('\n  Setting up PR Agent\n')

runMigrations()
const n = seed()
ok(`Database ready — ${n} venues at ${DB_PATH}`)

installSkill()

let registered = false
if (haveClaudeCli()) {
  registered = registerWithClaudeCode()
  if (registered) ok('Registered with Claude Code (user scope — available in every session)')
} else {
  warn('The `claude` CLI is not on your PATH, so Claude Code was skipped.')
}

const desktop = registerWithClaudeDesktop()

if (!registered && !desktop) {
  console.log('\n  Nothing was registered automatically. Do one of these:\n')
  console.log('  Claude Code:')
  console.log(`    claude mcp add --scope user --transport stdio ${NAME} -- ${TSX} ${ARGS.join(' ')}\n`)
  console.log('  Claude Desktop — add to claude_desktop_config.json:')
  console.log(
    JSON.stringify({ mcpServers: { [NAME]: { command: TSX, args: ARGS } } }, null, 2) + '\n',
  )
  process.exit(1)
}

console.log('\n  Done. Open Claude and try:\n')
console.log('    "what should I post today?"')
console.log('    "I just shipped <project> — help me launch it"\n')
console.log(`  Dashboard: ${baseUrl()} (Claude starts it on demand)`)
console.log('  Keep it always running: npm run install-service\n')
