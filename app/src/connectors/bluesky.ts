import type { Connector, Creds, PostPayload, PostResult } from './types'
import { composeBody, failed, isRetryableStatus, readError } from './types'

const DEFAULT_SERVICE = 'https://bsky.social'

type Session = { accessJwt: string; did: string; handle: string }

async function createSession(creds: Creds): Promise<Session> {
  const service = creds.service || DEFAULT_SERVICE
  const res = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      identifier: creds.identifier,
      password: creds.appPassword,
    }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as Session
}

/**
 * Bluesky does not linkify text on its own — a URL is inert unless the post
 * carries a byte-range facet pointing at it. Ranges are in UTF-8 bytes, not
 * JS string indices, so we index against the encoded buffer.
 */
function linkFacets(text: string) {
  const bytes = new TextEncoder().encode(text)
  const facets: unknown[] = []
  const re = /https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?]/g

  for (const m of text.matchAll(re)) {
    const prefix = new TextEncoder().encode(text.slice(0, m.index))
    const uriBytes = new TextEncoder().encode(m[0])
    facets.push({
      index: { byteStart: prefix.length, byteEnd: prefix.length + uriBytes.length },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    })
  }
  return { facets, byteLength: bytes.length }
}

/** Bluesky counts graphemes, so emoji and accents cost one, not several. */
function graphemeLength(s: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return [...seg.segment(s)].length
  }
  return [...s].length
}

export const blueskyConnector: Connector = {
  key: 'bluesky',
  name: 'Bluesky',
  mode: 'auto',
  setupNote:
    'Free, no approval needed. Create an app password at Settings → App Passwords in the Bluesky app — do not use your account password.',
  credentialFields: [
    {
      key: 'identifier',
      label: 'Handle or email',
      placeholder: 'you.bsky.social',
    },
    {
      key: 'appPassword',
      label: 'App password',
      secret: true,
      help: 'Settings → Privacy and Security → App Passwords. Not your login password.',
    },
    {
      key: 'service',
      label: 'PDS URL (optional)',
      placeholder: DEFAULT_SERVICE,
      help: 'Leave blank unless you self-host.',
    },
  ],

  async verify(creds) {
    try {
      const s = await createSession(creds)
      return { ok: true, handle: s.handle, meta: { did: s.did } }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async publish(payload: PostPayload, creds: Creds, opts): Promise<PostResult> {
    const text = composeBody(payload)
    const limit = payload.channel.charLimit ?? 300

    if (graphemeLength(text) > limit) {
      return failed(
        `Post is ${graphemeLength(text)} characters; Bluesky rejects anything over ${limit}.`,
      )
    }

    if (opts.dryRun) {
      return {
        kind: 'posted',
        externalUrl: 'https://bsky.app/dry-run',
        note: `DRY RUN — would post ${graphemeLength(text)} chars to Bluesky.`,
      }
    }

    try {
      const service = creds.service || DEFAULT_SERVICE
      const session = await createSession(creds)
      const { facets } = linkFacets(text)

      const res = await fetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text,
            createdAt: new Date().toISOString(),
            ...(facets.length ? { facets } : {}),
          },
        }),
      })

      if (!res.ok) {
        return failed(await readError(res), isRetryableStatus(res.status))
      }

      const data = (await res.json()) as { uri: string; cid: string }
      // at://did:plc:xxx/app.bsky.feed.post/RKEY -> web URL
      const rkey = data.uri.split('/').pop()
      return {
        kind: 'posted',
        externalId: data.uri,
        externalUrl: `https://bsky.app/profile/${session.handle}/post/${rkey}`,
      }
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e), true)
    }
  },
}
