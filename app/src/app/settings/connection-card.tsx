'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CredentialField } from '@/connectors/types'
import { Badge, Button, Card, Field, inputClass } from '@/components/ui'

export function ConnectionCard({
  connectorKey,
  name,
  setupNote,
  fields,
  connected,
  handle,
}: {
  connectorKey: string
  name: string
  setupNote?: string
  fields: CredentialField[]
  connected: boolean
  handle?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/connections/${connectorKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not connect')
      setOpen(false)
      setValues({})
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    await fetch(`/api/connections/${connectorKey}`, { method: 'DELETE' })
    setBusy(false)
    router.refresh()
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{name}</span>
        {connected ? (
          <Badge tone="good">{handle ? `Connected as ${handle}` : 'Connected'}</Badge>
        ) : (
          <Badge>Not connected</Badge>
        )}
        <div className="flex-1" />
        {connected ? (
          <Button variant="danger" onClick={disconnect} disabled={busy} className="text-xs">
            Disconnect
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setOpen((v) => !v)} className="text-xs">
            {open ? 'Cancel' : 'Connect'}
          </Button>
        )}
      </div>

      {setupNote && <p className="mt-2 text-xs text-muted prose-copy">{setupNote}</p>}

      {open && (
        <div className="mt-4 space-y-3 border-t border-edge pt-4">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} help={f.help}>
              <input
                type={f.secret ? 'password' : 'text'}
                placeholder={f.placeholder}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className={inputClass}
              />
            </Field>
          ))}
          {error && <p className="text-sm text-bad prose-copy">{error}</p>}
          <Button onClick={connect} disabled={busy}>
            {busy ? 'Verifying…' : 'Verify and connect'}
          </Button>
        </div>
      )}
    </Card>
  )
}
