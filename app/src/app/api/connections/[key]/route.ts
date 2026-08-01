import { NextResponse } from 'next/server'
import { isAuthed } from '@/lib/session'
import { getConnector } from '@/connectors/registry'
import { deleteConnection, saveConnection } from '@/lib/connections'
import type { Creds } from '@/connectors/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { key } = await params
  const connector = getConnector(key)
  const creds = (await request.json()) as Creds

  // Verify before storing — a credential that cannot authenticate is worse
  // than no credential, because the scheduler will keep retrying it.
  const check = await connector.verify(creds)
  if (!check.ok) {
    return NextResponse.json(
      { error: check.error ?? 'Could not authenticate with those credentials' },
      { status: 400 },
    )
  }

  await saveConnection({
    connectorKey: key,
    creds,
    displayName: check.handle,
    meta: check.meta,
  })

  return NextResponse.json({ ok: true, handle: check.handle })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { key } = await params
  await deleteConnection(key)
  return NextResponse.json({ ok: true })
}
