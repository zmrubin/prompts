import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { metrics, posts } from '@/db/schema'

export type Reading = { score?: number; comments?: number; error?: string }

/**
 * Reads public engagement numbers for a posted URL.
 *
 * Only venues with a genuinely open, auth-free, ToS-clean read API are here:
 * Hacker News (Firebase), Reddit (public .json), and Bluesky (AppView). Every
 * other venue is manual entry — no scraping, no credentials.
 */

async function hackernews(url: string): Promise<Reading> {
  const id = url.match(/[?&]id=(\d+)/)?.[1]
  if (!id) return { error: 'Not a Hacker News item URL' }
  const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
  if (!res.ok) return { error: `Hacker News returned ${res.status}` }
  const item = (await res.json()) as { score?: number; descendants?: number } | null
  if (!item) return { error: 'Item not found' }
  return { score: item.score, comments: item.descendants }
}

async function reddit(url: string): Promise<Reading> {
  const clean = url.split('?')[0].replace(/\/$/, '')
  const res = await fetch(`${clean}.json`, {
    headers: { 'user-agent': 'pr-agent-dashboard/1.0 (personal planning tool)' },
  })
  if (!res.ok) return { error: `Reddit returned ${res.status}` }
  const data = (await res.json()) as Array<{
    data?: { children?: Array<{ data?: { score?: number; num_comments?: number } }> }
  }>
  const d = data?.[0]?.data?.children?.[0]?.data
  if (!d) return { error: 'Could not read that Reddit post' }
  return { score: d.score, comments: d.num_comments }
}

async function bluesky(url: string): Promise<Reading> {
  // https://bsky.app/profile/<handle>/post/<rkey>
  const m = url.match(/profile\/([^/]+)\/post\/([^/?#]+)/)
  if (!m) return { error: 'Not a Bluesky post URL' }
  const [, handle, rkey] = m
  const at = `at://${handle}/app.bsky.feed.post/${rkey}`
  const res = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(at)}`,
  )
  if (!res.ok) return { error: `Bluesky returned ${res.status}` }
  const data = (await res.json()) as {
    posts?: Array<{ likeCount?: number; replyCount?: number; repostCount?: number }>
  }
  const p = data.posts?.[0]
  if (!p) return { error: 'Post not found' }
  return { score: (p.likeCount ?? 0) + (p.repostCount ?? 0), comments: p.replyCount }
}

const FETCHERS = { hackernews, reddit, bluesky } as const

export function canAutoFetch(source: string | null): source is keyof typeof FETCHERS {
  return !!source && source in FETCHERS
}

/** Fetches and records a reading. Returns what it stored, or the error. */
export async function refreshMetrics(
  postId: string,
  source: string | null,
  postedUrl: string | null,
): Promise<Reading> {
  if (!postedUrl) return { error: 'No posted URL saved yet' }
  if (!canAutoFetch(source)) return { error: 'This venue has no public metrics API' }

  let reading: Reading
  try {
    reading = await FETCHERS[source](postedUrl)
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  if (reading.error) return reading

  db.insert(metrics)
    .values({
      postId,
      score: reading.score ?? null,
      comments: reading.comments ?? null,
      source: 'auto',
    })
    .run()
  return reading
}

export function recordManual(postId: string, r: { score?: number; comments?: number; views?: number }) {
  db.insert(metrics)
    .values({
      postId,
      score: r.score ?? null,
      comments: r.comments ?? null,
      views: r.views ?? null,
      source: 'manual',
    })
    .run()
}

export function latestMetric(postId: string) {
  return db
    .select()
    .from(metrics)
    .where(eq(metrics.postId, postId))
    .orderBy(desc(metrics.capturedAt))
    .limit(1)
    .get()
}

/** Latest reading for every post in one query, keyed by post id. */
export function latestMetricsFor(postIds: string[]) {
  if (!postIds.length) return new Map<string, typeof metrics.$inferSelect>()
  const all = db.select().from(metrics).orderBy(desc(metrics.capturedAt)).all()
  const out = new Map<string, typeof metrics.$inferSelect>()
  for (const m of all) if (!out.has(m.postId)) out.set(m.postId, m)
  return out
}

export function postWithChannel(postId: string) {
  return db.select().from(posts).where(eq(posts.id, postId)).get()
}
