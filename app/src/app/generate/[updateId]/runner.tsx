'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui'

export function GenerateRunner({ updateId }: { updateId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // React 18+ mounts effects twice in dev; without this guard the plan
    // gets generated (and billed) twice.
    if (started.current) return
    started.current = true

    fetch('/api/plans/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ updateId }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Generation failed')
        router.replace(`/plans/${data.planId}`)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [updateId, router])

  if (error) {
    return (
      <Card>
        <h1 className="mb-2 text-lg font-semibold text-bad">Generation failed</h1>
        <p className="text-sm text-muted prose-copy">{error}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-accent hover:underline"
        >
          ← Go back
        </button>
      </Card>
    )
  }

  return (
    <Card className="flex items-center gap-4">
      <div className="size-5 animate-spin rounded-full border-2 border-edge border-t-accent" />
      <div>
        <div className="font-medium">Writing your launch plan…</div>
        <div className="text-sm text-muted">
          Picking channels and drafting a post for each one. Usually 20&ndash;60 seconds.
        </div>
      </div>
    </Card>
  )
}
