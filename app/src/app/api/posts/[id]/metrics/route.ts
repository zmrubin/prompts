import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { channels, posts } from '@/db/schema'
import { recordManual, refreshMetrics } from '@/lib/metrics'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = db.select().from(posts).where(eq(posts.id, id)).get()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))

  if (body?.manual) {
    recordManual(id, { score: body.score, comments: body.comments, views: body.views })
    return NextResponse.json({ ok: true })
  }

  const channel = db.select().from(channels).where(eq(channels.id, post.channelId)).get()
  const reading = await refreshMetrics(id, channel?.metricsSource ?? null, post.postedUrl)
  if (reading.error) return NextResponse.json({ error: reading.error }, { status: 400 })
  return NextResponse.json(reading)
}
