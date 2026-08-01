import { createHmac, randomBytes } from 'node:crypto'
import type { Connector, Creds, PostPayload, PostResult } from './types'
import { composeBody, failed, isRetryableStatus, readError } from './types'

/**
 * OAuth 1.0a user-context signing.
 *
 * X's v2 write endpoints accept either OAuth 2.0 PKCE (which needs a refresh
 * dance and a redirect URL) or OAuth 1.0a (four static strings). For a
 * single-user tool that runs unattended in a cron job, 1.0a is the one that
 * never needs re-authorising, so it is worth the signing code.
 */
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!*()']/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function oauthHeader(
  method: string,
  url: string,
  creds: Creds,
  /** Only query params are signed; a JSON body is not part of the signature. */
  queryParams: Record<string, string> = {},
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  }

  const allParams = { ...oauthParams, ...queryParams }
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&')

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&')

  const signingKey = `${percentEncode(creds.apiSecret)}&${percentEncode(
    creds.accessTokenSecret,
  )}`
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64')

  const header: Record<string, string> = { ...oauthParams, oauth_signature: signature }
  return `OAuth ${Object.keys(header)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(header[k])}"`)
    .join(', ')}`
}

export const xConnector: Connector = {
  key: 'x',
  name: 'X / Twitter',
  mode: 'auto',
  setupNote:
    'Costs money. X removed its free tier in February 2026 — posting is pay-per-use at roughly $0.015 per post, or about $0.20 if the post contains a link. You need an X developer account with billing attached. Create an app at developer.x.com, set it to Read and Write, then generate the four OAuth 1.0a keys.',
  credentialFields: [
    { key: 'apiKey', label: 'API key (consumer key)', secret: true },
    { key: 'apiSecret', label: 'API key secret', secret: true },
    { key: 'accessToken', label: 'Access token', secret: true },
    { key: 'accessTokenSecret', label: 'Access token secret', secret: true },
  ],

  async verify(creds) {
    try {
      const url = 'https://api.x.com/2/users/me'
      const res = await fetch(url, {
        headers: { authorization: oauthHeader('GET', url, creds) },
      })
      if (!res.ok) return { ok: false, error: await readError(res) }
      const data = (await res.json()) as { data: { username: string; id: string } }
      return { ok: true, handle: `@${data.data.username}`, meta: { id: data.data.id } }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async publish(payload: PostPayload, creds: Creds, opts): Promise<PostResult> {
    // linkPolicy is first_comment for X, so composeBody leaves the link out of
    // the main post; the reply is posted separately below.
    const text = composeBody(payload)
    const limit = payload.channel.charLimit ?? 280

    if ([...text].length > limit) {
      return failed(`Post is ${[...text].length} characters; X's limit is ${limit}.`)
    }

    if (opts.dryRun) {
      const cost = payload.linkUrl && payload.linkPlacement === 'body' ? '$0.20' : '$0.015'
      return {
        kind: 'posted',
        externalUrl: 'https://x.com/dry-run',
        note: `DRY RUN — would post ${[...text].length} chars to X (est. ${cost}).${
          payload.linkPlacement === 'first_comment' ? ' Link would follow as a reply.' : ''
        }`,
      }
    }

    try {
      const url = 'https://api.x.com/2/tweets'
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: oauthHeader('POST', url, creds),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) {
        return failed(await readError(res), isRetryableStatus(res.status))
      }
      const data = (await res.json()) as { data: { id: string } }
      const tweetId = data.data.id

      // The link goes in a reply so the main post keeps its reach.
      if (payload.linkUrl && payload.linkPlacement === 'first_comment') {
        await fetch(url, {
          method: 'POST',
          headers: {
            authorization: oauthHeader('POST', url, creds),
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            text: payload.linkUrl,
            reply: { in_reply_to_tweet_id: tweetId },
          }),
        }).catch(() => {
          // A failed reply must not undo a successful post; the main tweet is live.
        })
      }

      return {
        kind: 'posted',
        externalId: tweetId,
        externalUrl: `https://x.com/i/web/status/${tweetId}`,
      }
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e), true)
    }
  },
}
