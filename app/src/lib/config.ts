import { resolve } from 'node:path'

/**
 * One source of truth for where the dashboard lives.
 *
 * Hosts inject PORT; PRAGENT_PORT is the local override. 4321 rather than
 * 3000 so it doesn't collide with whatever else you have running on a normal
 * dev day.
 */
export const PORT = Number(process.env.PORT ?? process.env.PRAGENT_PORT ?? 4321)

/**
 * Absolute path to the app directory.
 *
 * Under tsx (the MCP server, the CLI scripts) the working directory is
 * whatever Claude Code happened to be in, so we anchor on this file's own
 * location. Under Next's webpack bundle `import.meta.dirname` is undefined,
 * but Next always runs from the app root, so cwd is correct there.
 */
export function appRoot(): string {
  const here = import.meta.dirname
  return here ? resolve(here, '..', '..') : process.cwd()
}

/**
 * The public origin of the dashboard.
 *
 * This is not cosmetic: importPlan writes it into every plan record, and the
 * MCP tools hand it to Claude as a link to give the user. Hosted, a localhost
 * URL here would produce plans full of links that only work on a machine that
 * isn't running the app.
 */
export function baseUrl(): string {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/+$/, '')
  // Railway sets this for you, which saves a manual step on first deploy.
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN
  if (railway) return `https://${railway}`
  return `http://localhost:${PORT}`
}
