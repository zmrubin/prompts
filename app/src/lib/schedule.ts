import { createHash } from 'node:crypto'

/** Stable key so the same draft at the same instant can never post twice. */
export function idempotencyKey(draftId: string, scheduledFor: Date): string {
  return createHash('sha256')
    .update(`${draftId}:${scheduledFor.toISOString()}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Turns the model's suggested hour offsets into real timestamps, then nudges
 * anything that would collide with another post on the same channel out past
 * that channel's minimum spacing.
 */
export function planSchedule(
  items: { draftId: string; channelId: string; offsetHours: number; minSpacingMinutes: number }[],
  launchAt: Date,
): { draftId: string; channelId: string; scheduledFor: Date }[] {
  const lastByChannel = new Map<string, number>()
  const out: { draftId: string; channelId: string; scheduledFor: Date }[] = []

  for (const item of [...items].sort((a, b) => a.offsetHours - b.offsetHours)) {
    let at = launchAt.getTime() + item.offsetHours * 3600_000
    const previous = lastByChannel.get(item.channelId)
    if (previous !== undefined) {
      const earliest = previous + item.minSpacingMinutes * 60_000
      if (at < earliest) at = earliest
    }
    lastByChannel.set(item.channelId, at)
    out.push({ draftId: item.draftId, channelId: item.channelId, scheduledFor: new Date(at) })
  }

  return out
}

export function backoffMinutes(attempts: number): number {
  return Math.min(60 * 6, 5 * Math.pow(3, Math.max(0, attempts - 1)))
}
