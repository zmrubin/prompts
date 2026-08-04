import { resolve } from 'node:path'

/**
 * One source of truth for where the dashboard lives.
 *
 * 4321 rather than 3000 so it doesn't collide with whatever else you have
 * running on a normal dev day — this is meant to sit there permanently.
 */
export const PORT = Number(process.env.PRAGENT_PORT ?? 4321)

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

export function baseUrl(): string {
  return `http://localhost:${PORT}`
}
