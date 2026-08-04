/**
 * One source of truth for where the dashboard lives.
 *
 * 4321 rather than 3000 so it doesn't collide with whatever else you have
 * running on a normal dev day — this is meant to sit there permanently.
 */
export const PORT = Number(process.env.PRAGENT_PORT ?? 4321)

export function baseUrl(): string {
  return `http://localhost:${PORT}`
}
