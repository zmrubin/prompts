'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'

export function DryRunToggle({
  dryRun,
  envLocked,
}: {
  dryRun: boolean
  envLocked: boolean
}) {
  const router = useRouter()
  const [on, setOn] = useState(dryRun)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next = !on
    setBusy(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dryRun: next }),
    })
    setOn(next)
    setBusy(false)
    router.refresh()
  }

  if (envLocked) {
    return (
      <div>
        <div className="font-medium text-warn">Dry run is locked on</div>
        <p className="mt-1 text-sm text-muted prose-copy">
          The <code>DRY_RUN</code> environment variable is set, which overrides this toggle.
          Posts are simulated and logged; nothing reaches a real account. Remove{' '}
          <code>DRY_RUN</code> from your Railway variables (or set it to{' '}
          <code>false</code>) to allow real posting.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="font-medium">{on ? 'Dry run is on' : 'Live posting is on'}</div>
        <p className="mt-1 text-sm text-muted prose-copy">
          {on
            ? 'Posts are simulated and logged. Nothing reaches a real account. Good for testing the whole pipeline safely.'
            : 'Scheduled posts will be published for real to every connected account. X charges per post.'}
        </p>
      </div>
      <Button
        variant={on ? 'primary' : 'danger'}
        onClick={toggle}
        disabled={busy}
        className="shrink-0"
      >
        {on ? 'Go live' : 'Back to dry run'}
      </Button>
    </div>
  )
}
