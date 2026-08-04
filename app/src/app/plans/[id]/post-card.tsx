'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Channel, Metric, Post } from '@/db/schema'
import type { Cooldown } from '@/lib/status'
import { Badge, Button, Card } from '@/components/ui'
import { CopyButton } from '@/components/copy-block'

const glen = (s: string) => [...s].length

export function PostCard({
  post,
  channel,
  submitUrl,
  clipboard,
  metric,
  canAutoFetch,
  cooldown,
}: {
  post: Post
  channel: Channel
  submitUrl: string
  clipboard: string
  metric?: Metric | null
  canAutoFetch: boolean
  cooldown?: Cooldown | null
}) {
  const router = useRouter()
  const [title, setTitle] = useState(post.title ?? '')
  const [body, setBody] = useState(post.body)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState(post.postedUrl ?? '')
  const [open, setOpen] = useState(post.status === 'todo')
  const [err, setErr] = useState<string | null>(null)

  const bodyOver = channel.charLimit ? glen(body) > channel.charLimit : false
  const titleOver = channel.titleCharLimit ? glen(title) > channel.titleCharLimit : false

  async function patch(payload: Record<string, unknown>) {
    setBusy(true)
    setErr(null)
    // Marking something posted is exactly when you want to paste its URL in,
    // so keep the card open rather than collapsing it out from under you.
    if (payload.status === 'posted') setOpen(true)
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setBusy(false)
    if (!res.ok) {
      setErr('Could not save.')
      return false
    }
    router.refresh()
    return true
  }

  async function save() {
    if (await patch({ title: title || null, body })) setDirty(false)
  }

  async function refreshMetrics() {
    setBusy(true)
    setErr(null)
    const res = await fetch(`/api/posts/${post.id}/metrics`, { method: 'POST' })
    const data = await res.json()
    setBusy(false)
    if (!res.ok || data.error) setErr(data.error ?? 'Could not fetch metrics.')
    else router.refresh()
  }

  const done = post.status === 'posted'
  const skipped = post.status === 'skipped'

  return (
    <Card className={skipped ? 'opacity-50' : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{channel.name}</span>
        {done && <Badge tone="good">Posted</Badge>}
        {skipped && <Badge>Skipped</Badge>}
        {!done && !skipped && post.dayOffset > 0 && <Badge>day {post.dayOffset}</Badge>}
        {channel.linkPolicy === 'first_comment' && <Badge tone="warn">link in first comment</Badge>}
        {channel.linkPolicy === 'not_clickable' && <Badge tone="warn">link not clickable</Badge>}
        {channel.requiresImage && <Badge tone="warn">image required</Badge>}
        <div className="flex-1" />
        {metric && (
          <span className="font-mono text-xs text-muted">
            {metric.score != null && `${metric.score} pts`}
            {metric.score != null && metric.comments != null && ' · '}
            {metric.comments != null && `${metric.comments} comments`}
          </span>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-muted hover:text-white"
          type="button"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {post.rationale && <p className="mt-2 text-xs italic text-muted">{post.rationale}</p>}

      {cooldown?.cooling && post.status === 'todo' && (
        <p className="mt-2 rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
          Posted here{' '}
          {cooldown.daysSinceLastPost === 0
            ? 'today'
            : `${cooldown.daysSinceLastPost} ${cooldown.daysSinceLastPost === 1 ? 'day' : 'days'} ago`}
          {cooldown.lastPostedProject ? ` (${cooldown.lastPostedProject})` : ''}. This venue
          expects about {cooldown.cooldownDays} days between promotional posts — wait{' '}
          {cooldown.daysRemaining} more, or you risk being removed.
        </p>
      )}

      {open && (
        <>
          {(channel.titleCharLimit || post.title) && (
            <div className="mt-3">
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDirty(true)
                }}
                placeholder="Title"
                className={`w-full rounded-md border bg-ink px-3 py-2 text-sm font-medium outline-none focus:border-accent ${
                  titleOver ? 'border-bad' : 'border-edge'
                }`}
              />
              {channel.titleCharLimit && (
                <span
                  className={`mt-1 block font-mono text-xs ${titleOver ? 'text-bad' : 'text-muted'}`}
                >
                  title {glen(title)} / {channel.titleCharLimit}
                  {titleOver && ' — too long'}
                </span>
              )}
            </div>
          )}

          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setDirty(true)
            }}
            rows={Math.min(18, Math.max(4, Math.ceil(body.length / 68)))}
            className={`mt-2 w-full rounded-md border bg-ink px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent ${
              bodyOver ? 'border-bad' : 'border-edge'
            }`}
          />
          {channel.charLimit && (
            <span className={`font-mono text-xs ${bodyOver ? 'text-bad' : 'text-muted'}`}>
              body {glen(body)} / {channel.charLimit}
              {bodyOver && ' — over the limit, this will be rejected'}
            </span>
          )}

          {post.linkPlacement === 'first_comment' && post.linkUrl && (
            <div className="mt-3 rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
              Post the body first, then add this as the first comment:
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all font-mono">{post.linkUrl}</code>
                <CopyButton text={post.linkUrl} label="Copy link" />
              </div>
            </div>
          )}

          {post.imagePrompt && (
            <p className="mt-3 text-xs text-muted">
              <span className="uppercase tracking-wide">Visual:</span> {post.imagePrompt}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyButton text={clipboard} label="Copy post" big />
            <a
              href={submitUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-edge px-2.5 py-1.5 text-xs text-accent hover:underline"
            >
              Open {channel.name} ↗
            </a>
            {dirty && (
              <Button variant="ghost" onClick={save} disabled={busy} className="text-xs">
                {busy ? 'Saving…' : 'Save edits'}
              </Button>
            )}
            <div className="flex-1" />
            {!done && (
              <Button
                variant="ghost"
                onClick={() => patch({ status: 'posted' })}
                disabled={busy}
                className="text-xs"
              >
                Mark posted
              </Button>
            )}
            {!skipped && !done && (
              <Button
                variant="ghost"
                onClick={() => patch({ status: 'skipped' })}
                disabled={busy}
                className="text-xs"
              >
                Skip
              </Button>
            )}
            {(done || skipped) && (
              <Button
                variant="ghost"
                onClick={() => patch({ status: 'todo' })}
                disabled={busy}
                className="text-xs"
              >
                Undo
              </Button>
            )}
          </div>

          {done && (
            <div className="mt-3 border-t border-edge pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste the URL of your post to track it"
                  className="min-w-0 flex-1 rounded-md border border-edge bg-ink px-3 py-1.5 font-mono text-xs outline-none focus:border-accent"
                />
                <Button
                  variant="ghost"
                  onClick={() => patch({ postedUrl: url || null })}
                  disabled={busy}
                  className="text-xs"
                >
                  Save URL
                </Button>
                {post.postedUrl && canAutoFetch && (
                  <Button variant="ghost" onClick={refreshMetrics} disabled={busy} className="text-xs">
                    {busy ? 'Fetching…' : 'Refresh stats'}
                  </Button>
                )}
              </div>
              {post.postedUrl && !canAutoFetch && (
                <ManualMetrics postId={post.id} onDone={() => router.refresh()} />
              )}
            </div>
          )}

          {err && <p className="mt-2 text-xs text-bad">{err}</p>}

          {channel.postingRules && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted hover:text-white">
                Rules for {channel.name}
              </summary>
              <p className="prose-copy mt-2 text-xs text-muted">{channel.postingRules}</p>
            </details>
          )}
        </>
      )}
    </Card>
  )
}

function ManualMetrics({ postId, onDone }: { postId: string; onDone: () => void }) {
  const [score, setScore] = useState('')
  const [comments, setComments] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    await fetch(`/api/posts/${postId}/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        manual: true,
        score: score ? Number(score) : undefined,
        comments: comments ? Number(comments) : undefined,
      }),
    })
    setBusy(false)
    setScore('')
    setComments('')
    onDone()
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">No public API here — log it yourself:</span>
      <input
        value={score}
        onChange={(e) => setScore(e.target.value)}
        placeholder="upvotes"
        inputMode="numeric"
        className="w-24 rounded-md border border-edge bg-ink px-2 py-1 font-mono text-xs outline-none focus:border-accent"
      />
      <input
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="comments"
        inputMode="numeric"
        className="w-24 rounded-md border border-edge bg-ink px-2 py-1 font-mono text-xs outline-none focus:border-accent"
      />
      <Button variant="ghost" onClick={submit} disabled={busy} className="text-xs">
        Log
      </Button>
    </div>
  )
}
