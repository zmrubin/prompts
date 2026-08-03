'use client'

import { useState } from 'react'
import type { Channel, PostDraft } from '@/db/schema'
import { Badge, Button, Card } from '@/components/ui'

const AUTOMATION_NOTE: Record<string, { tone: 'good' | 'warn' | 'neutral'; label: string }> = {
  auto: { tone: 'good', label: 'Posts automatically' },
  gated: { tone: 'warn', label: 'Needs setup' },
  manual: { tone: 'neutral', label: 'You post this one' },
}

export function DraftEditor({ draft, channel }: { draft: PostDraft; channel: Channel }) {
  const [title, setTitle] = useState(draft.title ?? '')
  const [body, setBody] = useState(draft.body)
  const [saved, setSaved] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const limit = channel.charLimit
  const over = limit ? [...body].length > limit : false
  const titleLimit = channel.titleCharLimit
  const titleOver = titleLimit ? [...title].length > titleLimit : false
  const note = AUTOMATION_NOTE[channel.automation]

  async function save() {
    setSaving(true)
    await fetch(`/api/drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title || null, body }),
    })
    setSaving(false)
    setSaved(true)
  }

  async function copy() {
    await navigator.clipboard.writeText([title, body].filter(Boolean).join('\n\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-medium">{channel.name}</span>
        <Badge tone={note.tone}>{note.label}</Badge>
        {draft.suggestedOffsetHours > 0 && (
          <Badge>+{draft.suggestedOffsetHours}h</Badge>
        )}
        {channel.linkPolicy === 'first_comment' && <Badge tone="warn">link in comment</Badge>}
        {channel.linkPolicy === 'not_clickable' && <Badge tone="warn">link not clickable</Badge>}
      </div>

      {draft.rationale && (
        <p className="mb-3 text-xs text-muted italic">{draft.rationale}</p>
      )}

      {(channel.category === 'reddit' ||
        channel.id === 'hackernews' ||
        channel.id === 'devto' ||
        draft.title) && (
        <div className="mb-2">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setSaved(false)
            }}
            placeholder="Title"
            className={`w-full rounded-md border bg-ink px-3 py-2 text-sm font-medium outline-none focus:border-accent ${
              titleOver ? 'border-bad' : 'border-edge'
            }`}
          />
          {titleLimit && (
            <span className={`mt-1 block text-xs ${titleOver ? 'text-bad' : 'text-muted'}`}>
              title {[...title].length} / {titleLimit}
              {titleOver && ' — too long'}
            </span>
          )}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          setSaved(false)
        }}
        rows={Math.min(16, Math.max(4, Math.ceil(body.length / 70)))}
        className="w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {limit && (
          <span className={`text-xs ${over ? 'text-bad' : 'text-muted'}`}>
            body {[...body].length} / {limit}
            {over && ' — too long, this will be rejected'}
          </span>
        )}
        <div className="flex-1" />
        <button onClick={copy} className="text-xs text-muted hover:text-white">
          {copied ? 'Copied' : 'Copy'}
        </button>
        {channel.automation === 'manual' && channel.submitUrlTemplate && (
          <a
            href={buildSubmitUrl(channel, draft, title)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Open submit form ↗
          </a>
        )}
        <Button
          variant="ghost"
          onClick={save}
          disabled={saved || saving}
          className="text-xs"
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </Button>
      </div>

      {channel.postingRules && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted hover:text-white">
            Rules for {channel.name}
          </summary>
          <p className="mt-2 text-xs text-muted prose-copy">{channel.postingRules}</p>
        </details>
      )}
    </Card>
  )
}

function buildSubmitUrl(channel: Channel, draft: PostDraft, title: string): string {
  return (channel.submitUrlTemplate ?? '')
    .replace('{url}', encodeURIComponent(draft.linkUrl ?? ''))
    .replace('{title}', encodeURIComponent(title || draft.title || ''))
    .replace('{repo}', '')
}
