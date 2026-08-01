'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Channel, PostDraft, ScheduledPost } from '@/db/schema'
import { Badge, Button, Card, statusBadge } from '@/components/ui'

export function QueueItem({
  row,
  draft,
  channel,
}: {
  row: ScheduledPost
  draft: PostDraft
  channel: Channel
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(row.status === 'manual_pending')

  const badge = statusBadge(row.status)

  async function act(action: string) {
    setBusy(true)
    await fetch(`/api/scheduled/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusy(false)
    router.refresh()
  }

  async function copy() {
    await navigator.clipboard.writeText(
      [draft.title, draft.body, draft.linkUrl].filter(Boolean).join('\n\n'),
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const submitUrl = (channel.submitUrlTemplate ?? channel.homepageUrl ?? '')
    .replace('{url}', encodeURIComponent(draft.linkUrl ?? ''))
    .replace('{title}', encodeURIComponent(draft.title ?? ''))
    .replace('{repo}', '')

  return (
    <Card id={row.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{channel.name}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <span className="text-xs text-muted">{row.scheduledFor.toLocaleString()}</span>
        <div className="flex-1" />
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted hover:text-white"
        >
          {expanded ? 'Hide' : 'Show copy'}
        </button>
      </div>

      {row.lastError && (
        <p className="mt-2 text-xs text-bad prose-copy">{row.lastError}</p>
      )}

      {expanded && (
        <div className="mt-3 rounded-md border border-edge bg-ink p-3">
          {draft.title && <div className="mb-2 text-sm font-medium">{draft.title}</div>}
          <div className="text-sm text-muted prose-copy">{draft.body}</div>
          {draft.linkUrl && (
            <div className="mt-2 text-xs text-accent">{draft.linkUrl}</div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {row.status === 'manual_pending' && (
          <>
            <button onClick={copy} className="text-xs text-muted hover:text-white">
              {copied ? 'Copied' : 'Copy post'}
            </button>
            {submitUrl && (
              <a
                href={submitUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline"
              >
                Open {channel.name} ↗
              </a>
            )}
            <Button
              variant="ghost"
              onClick={() => act('mark_posted')}
              disabled={busy}
              className="text-xs"
            >
              Mark as posted
            </Button>
          </>
        )}

        {row.status === 'failed' && (
          <Button variant="ghost" onClick={() => act('retry')} disabled={busy} className="text-xs">
            Retry now
          </Button>
        )}

        {['scheduled', 'manual_pending', 'failed'].includes(row.status) && (
          <Button variant="ghost" onClick={() => act('skip')} disabled={busy} className="text-xs">
            Skip
          </Button>
        )}

        {row.externalUrl && ['posted', 'manual_done'].includes(row.status) && (
          <a
            href={row.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            View post ↗
          </a>
        )}
      </div>
    </Card>
  )
}
