import type { Connector, Creds, PostPayload, PostResult } from './types'
import { composeBody, failed, isRetryableStatus, readError } from './types'

function base(creds: Creds): string {
  return (creds.instanceUrl || 'https://mastodon.social').replace(/\/+$/, '')
}

export const mastodonConnector: Connector = {
  key: 'mastodon',
  name: 'Mastodon',
  mode: 'auto',
  setupNote:
    'Free, no approval needed. On your instance: Preferences → Development → New application, tick write:statuses, then copy the access token.',
  credentialFields: [
    {
      key: 'instanceUrl',
      label: 'Instance URL',
      placeholder: 'https://mastodon.social',
    },
    {
      key: 'accessToken',
      label: 'Access token',
      secret: true,
      help: 'Needs the write:statuses scope.',
    },
  ],

  async verify(creds) {
    try {
      const res = await fetch(`${base(creds)}/api/v1/accounts/verify_credentials`, {
        headers: { authorization: `Bearer ${creds.accessToken}` },
      })
      if (!res.ok) return { ok: false, error: await readError(res) }
      const acct = (await res.json()) as { acct: string; url: string }
      return { ok: true, handle: acct.acct, meta: { url: acct.url } }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async publish(payload: PostPayload, creds: Creds, opts): Promise<PostResult> {
    const status = composeBody(payload)
    const limit = payload.channel.charLimit ?? 500

    if ([...status].length > limit) {
      return failed(
        `Post is ${[...status].length} characters; this instance's limit is ${limit}.`,
      )
    }

    if (opts.dryRun) {
      return {
        kind: 'posted',
        externalUrl: `${base(creds)}/dry-run`,
        note: `DRY RUN — would post ${[...status].length} chars to Mastodon.`,
      }
    }

    try {
      const res = await fetch(`${base(creds)}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${creds.accessToken}`,
          'content-type': 'application/json',
          // Mastodon dedupes identical bodies posted within a short window.
          'Idempotency-Key': `${payload.channel.id}:${status.slice(0, 64)}`,
        },
        body: JSON.stringify({ status, visibility: 'public' }),
      })

      if (!res.ok) {
        return failed(await readError(res), isRetryableStatus(res.status))
      }
      const data = (await res.json()) as { id: string; url: string }
      return { kind: 'posted', externalId: data.id, externalUrl: data.url }
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e), true)
    }
  },
}
