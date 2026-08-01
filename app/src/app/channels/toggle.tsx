'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ChannelToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter()
  const [on, setOn] = useState(enabled)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next = !on
    setOn(next)
    setBusy(true)
    await fetch(`/api/channels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    })
    setBusy(false)
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded px-2 py-1 text-xs transition ${
        on ? 'bg-accent/15 text-accent' : 'bg-edge text-muted'
      }`}
    >
      {on ? 'Enabled' : 'Disabled'}
    </button>
  )
}
