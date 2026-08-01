import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { postDrafts } from '@/db/schema'
import { isAuthed } from '@/lib/session'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json()) as {
    title?: string | null
    body?: string
    approved?: boolean
  }

  await db
    .update(postDrafts)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.approved !== undefined ? { approved: body.approved } : {}),
      editedByUser: true,
      updatedAt: new Date(),
    })
    .where(eq(postDrafts.id, id))

  return NextResponse.json({ ok: true })
}
