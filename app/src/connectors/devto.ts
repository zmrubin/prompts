import type { Connector, Creds, PostPayload, PostResult } from './types'
import { failed, isRetryableStatus, readError } from './types'

export const devtoConnector: Connector = {
  key: 'devto',
  name: 'DEV.to',
  mode: 'auto',
  setupNote:
    'Free, no approval needed. Settings → Extensions → DEV Community API Keys. Tip: leave "Publish immediately" off to push articles as unpublished drafts first.',
  credentialFields: [
    { key: 'apiKey', label: 'API key', secret: true },
    {
      key: 'publish',
      label: 'Publish immediately? (true/false)',
      placeholder: 'false',
      help: 'false posts as an unpublished draft you review on dev.to first. Recommended.',
    },
  ],

  async verify(creds) {
    try {
      const res = await fetch('https://dev.to/api/users/me', {
        headers: { 'api-key': creds.apiKey },
      })
      if (!res.ok) return { ok: false, error: await readError(res) }
      const me = (await res.json()) as { username: string }
      return { ok: true, handle: me.username }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async publish(payload: PostPayload, creds: Creds, opts): Promise<PostResult> {
    const title = payload.title?.trim()
    if (!title) {
      return failed('DEV.to requires a title; this draft has none.')
    }

    const published = creds.publish === 'true'
    let bodyMarkdown = payload.body
    if (payload.linkUrl && payload.linkPlacement === 'body') {
      bodyMarkdown += `\n\n---\n\n[${title}](${payload.linkUrl})`
    }

    if (opts.dryRun) {
      return {
        kind: 'posted',
        externalUrl: 'https://dev.to/dry-run',
        note: `DRY RUN — would create a DEV.to article titled "${title}" (published=${published}).`,
      }
    }

    try {
      const res = await fetch('https://dev.to/api/articles', {
        method: 'POST',
        headers: { 'api-key': creds.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          article: {
            title,
            body_markdown: bodyMarkdown,
            published,
            ...(payload.linkUrl ? { canonical_url: undefined } : {}),
          },
        }),
      })

      if (!res.ok) {
        return failed(await readError(res), isRetryableStatus(res.status))
      }
      const data = (await res.json()) as { id: number; url: string }
      return {
        kind: 'posted',
        externalId: String(data.id),
        externalUrl: data.url,
        note: published ? undefined : 'Created as an unpublished draft on DEV.to.',
      }
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e), true)
    }
  },
}
