import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { PORT, baseUrl } from '@/lib/config'

const ROOT = resolve(import.meta.dirname, '../..')

export const dashboardUrl = baseUrl

async function isUp(): Promise<boolean> {
  try {
    const res = await fetch(dashboardUrl(), { signal: AbortSignal.timeout(1500) })
    return res.status < 500
  } catch {
    return false
  }
}

/**
 * Starts the dashboard on demand and detaches it, so it outlives this MCP
 * process. That is what makes "just ask Claude" work: you never start a
 * server yourself, and closing Claude does not kill the dashboard.
 */
export async function ensureDashboard(): Promise<boolean> {
  if (await isUp()) return false

  const built = existsSync(resolve(ROOT, '.next/BUILD_ID'))
  const args = built ? ['run', 'start'] : ['run', 'dev']

  const child = spawn('npm', [...args, '--', '--port', String(PORT)], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(PORT) },
  })
  child.unref()

  // Give it a moment to bind before reporting the URL as usable.
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (await isUp()) return true
  }
  return true
}
