import type { Connector, Creds, PostPayload, PostResult } from './types'
import { failed, isRetryableStatus, readError } from './types'

const UA = 'web:pr-agent-dashboard:v0.1.0 (personal use)'

/** Script-type app: username+password grant, no redirect flow, no refresh. */
async function token(creds: Creds): Promise<string> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': UA,
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: creds.username,
      password: creds.password,
    }),
  })
  if (!res.ok) throw new Error(await readError(res))
  const data = (await res.json()) as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(data.error ?? 'No access token returned')
  return data.access_token
}

/** "reddit:sideproject" -> "SideProject" (canonical casing from the seed name). */
function subredditOf(channelId: string, channelName: string): string {
  return channelName.replace(/^r\//, '') || channelId.split(':')[1]
}

export const redditConnector: Connector = {
  key: 'reddit',
  name: 'Reddit',
  mode: 'auto',
  setupNote:
    'Needs manual approval. Self-service OAuth registration is closed — new app credentials take roughly 2-4 weeks to be approved. Create a "script" type app at reddit.com/prefs/apps. Until approval lands, Reddit channels fall back to copy-and-open. Note that most subreddits restrict self-promotion; check each one\'s rules before scheduling.',
  credentialFields: [
    { key: 'clientId', label: 'Client ID', secret: true },
    { key: 'clientSecret', label: 'Client secret', secret: true },
    { key: 'username', label: 'Reddit username' },
    { key: 'password', label: 'Reddit password', secret: true },
  ],

  async verify(creds) {
    try {
      const t = await token(creds)
      const res = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: { authorization: `Bearer ${t}`, 'user-agent': UA },
      })
      if (!res.ok) return { ok: false, error: await readError(res) }
      const me = (await res.json()) as { name: string }
      return { ok: true, handle: `u/${me.name}` }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async publish(payload: PostPayload, creds: Creds, opts): Promise<PostResult> {
    const sr = subredditOf(payload.channel.id, payload.channel.name)
    const title = payload.title?.trim()
    if (!title) return failed('Reddit requires a title; this draft has none.')
    const titleLimit = payload.channel.titleCharLimit ?? 300
    if (title.length > titleLimit) {
      return failed(`Title is ${title.length} characters; Reddit's limit is ${titleLimit}.`)
    }

    // A self post with the link in the body reliably outperforms a link post
    // in the communities we target, and dodges most "no link posts" rules.
    const body = payload.linkUrl
      ? `${payload.body}\n\n${payload.linkUrl}`
      : payload.body

    if (opts.dryRun) {
      return {
        kind: 'posted',
        externalUrl: `https://reddit.com/r/${sr}/dry-run`,
        note: `DRY RUN — would submit a self post titled "${title}" to r/${sr}.`,
      }
    }

    try {
      const t = await token(creds)
      const res = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${t}`,
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': UA,
        },
        body: new URLSearchParams({
          sr,
          kind: 'self',
          title,
          text: body,
          api_type: 'json',
          resubmit: 'true',
        }),
      })

      if (!res.ok) {
        return failed(await readError(res), isRetryableStatus(res.status))
      }

      // Reddit returns HTTP 200 with the real error nested in the JSON body.
      const data = (await res.json()) as {
        json?: { errors?: string[][]; data?: { url?: string; id?: string } }
      }
      const errors = data.json?.errors ?? []
      if (errors.length) {
        const msg = errors.map((e) => e.join(': ')).join('; ')
        // RATELIMIT is the one Reddit error that genuinely resolves on retry.
        return failed(`Reddit rejected the post: ${msg}`, /RATELIMIT/i.test(msg))
      }

      return {
        kind: 'posted',
        externalId: data.json?.data?.id,
        externalUrl: data.json?.data?.url,
      }
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e), true)
    }
  },
}
