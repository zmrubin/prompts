'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProviderSpec } from '@/llm/providers'
import { Badge, Button, Card, Field, inputClass } from '@/components/ui'

export function LlmSettings({
  provider,
  model,
  providers,
  storedKeys,
}: {
  provider: string
  model: string
  providers: ProviderSpec[]
  storedKeys: Record<string, boolean>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(provider)
  const [selectedModel, setSelectedModel] = useState(model)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const spec = providers.find((p) => p.id === selected) ?? providers[0]

  async function save() {
    setBusy(true)
    setMessage(null)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        llmProvider: selected,
        llmModel: selectedModel,
        ...(apiKey ? { apiKey: { provider: selected, key: apiKey } } : {}),
      }),
    })
    setBusy(false)
    setApiKey('')
    setMessage(res.ok ? 'Saved.' : 'Could not save.')
    router.refresh()
  }

  return (
    <Card className="space-y-5">
      <Field label="Provider">
        <select
          value={selected}
          onChange={(e) => {
            const next = e.target.value
            setSelected(next)
            const p = providers.find((x) => x.id === next)
            if (p) setSelectedModel(p.models[0].id)
          }}
          className={inputClass}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {storedKeys[p.id] ? ' — key stored' : ''}
            </option>
          ))}
        </select>
      </Field>

      <p className="text-xs text-muted">{spec.costNote}</p>

      <Field label="Model">
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className={inputClass}
        >
          {spec.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {m.note ? ` — ${m.note}` : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={`${spec.name} API key`}
        help={
          storedKeys[spec.id]
            ? 'A key is already stored. Enter a new one only to replace it.'
            : `Get one at ${spec.keyUrl}`
        }
      >
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={storedKeys[spec.id] ? '••••••••' : 'Paste your key'}
          className={inputClass}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        {storedKeys[spec.id] && <Badge tone="good">Key stored</Badge>}
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
    </Card>
  )
}
