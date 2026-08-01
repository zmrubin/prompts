import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { connections } from '@/db/schema'
import { decryptJson, encryptJson } from './crypto'
import type { Creds } from '@/connectors/types'

export async function listConnections() {
  return db.select().from(connections)
}

export async function getCreds(connectorKey: string): Promise<Creds | null> {
  const rows = await db
    .select()
    .from(connections)
    .where(eq(connections.connectorKey, connectorKey))
    .limit(1)
  if (!rows[0]) return null
  try {
    return decryptJson<Creds>(rows[0].credentialsEncrypted)
  } catch {
    return null
  }
}

export async function saveConnection(args: {
  connectorKey: string
  creds: Creds
  displayName?: string
  meta?: Record<string, unknown>
}) {
  const payload = {
    connectorKey: args.connectorKey,
    credentialsEncrypted: encryptJson(args.creds),
    displayName: args.displayName ?? null,
    meta: args.meta ?? null,
    status: 'connected' as const,
    lastVerifiedAt: new Date(),
    lastError: null,
    updatedAt: new Date(),
  }
  await db
    .insert(connections)
    .values(payload)
    .onConflictDoUpdate({ target: connections.connectorKey, set: payload })
}

export async function deleteConnection(connectorKey: string) {
  await db.delete(connections).where(eq(connections.connectorKey, connectorKey))
}

export async function markConnectionError(connectorKey: string, error: string) {
  await db
    .update(connections)
    .set({ status: 'needs_reauth', lastError: error, updatedAt: new Date() })
    .where(eq(connections.connectorKey, connectorKey))
}
