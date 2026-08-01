'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'

function defaultLaunchAt(): string {
  // Next full hour, in the format datetime-local expects.
  const d = new Date(Date.now() + 3600_000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ScheduleAll({ planId }: { planId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [launchAt, setLaunchAt] = useState(defaultLaunchAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId, launchAt: new Date(launchAt).toISOString() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scheduling failed')
      router.push('/queue')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Schedule all</Button>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="datetime-local"
        value={launchAt}
        onChange={(e) => setLaunchAt(e.target.value)}
        className="rounded-md border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <Button onClick={submit} disabled={busy}>
        {busy ? 'Scheduling…' : 'Confirm'}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
        Cancel
      </Button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  )
}
