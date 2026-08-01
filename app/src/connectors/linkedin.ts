import type { Connector, Creds, PostPayload, PostResult } from './types'
import { composeBody, failed, isRetryableStatus, readError } from './types'

const VERSION = '202405'

export const linkedinConnector: Connector = {
  key: 'linkedin',
  name: 'LinkedIn',
  mode: 'auto',
  setupNote:
    'Needs app approval. Create an app at linkedin.com/developers, request the "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect" products, then generate a member access token with the w_member_social scope. The broader Community Management API is restricted to registered legal entities, so this connector deliberately uses the personal-share path only. Tokens expire after about 60 days and must be refreshed by hand.',
  credentialFields: [
    {
      key: 'accessToken',
      label: 'Access token',
      secret: true,
      help: 'Needs w_member_social. Expires roughly every 60 days.',
    },
    {
      key: 'personUrn',
      label: 'Person URN (optional)',
      placeholder: 'urn:li:person:xxxxxxxx',
      help: 'Left blank, it is resolved from the token via /v2/userinfo.',
    },
  ],

  async verify(creds) {
    try {
      const res = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { authorization: `Bearer ${creds.accessToken}` },
      })
      if (!res.ok) return { ok: false, error: await readError(res) }
      const me = (await res.json()) as { sub: string; name?: string }
      return {
        ok: true,
        handle: me.name ?? me.sub,
        meta: { personUrn: `urn:li:person:${me.sub}` },
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async publish(payload: PostPayload, creds: Creds, opts): Promise<PostResult> {
    // linkPolicy is first_comment, so the link is excluded from the body here.
    const commentary = composeBody(payload)
    const limit = payload.channel.charLimit ?? 3000

    if (commentary.length > limit) {
      return failed(
        `Post is ${commentary.length} characters; LinkedIn's limit is ${limit}.`,
      )
    }

    if (opts.dryRun) {
      return {
        kind: 'posted',
        externalUrl: 'https://linkedin.com/dry-run',
        note: `DRY RUN — would post ${commentary.length} chars to LinkedIn.${
          payload.linkPlacement === 'first_comment'
            ? ' Link would be added as the first comment.'
            : ''
        }`,
      }
    }

    try {
      let author = creds.personUrn
      if (!author) {
        const who = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { authorization: `Bearer ${creds.accessToken}` },
        })
        if (!who.ok) return failed(await readError(who), isRetryableStatus(who.status))
        author = `urn:li:person:${((await who.json()) as { sub: string }).sub}`
      }

      const res = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${creds.accessToken}`,
          'content-type': 'application/json',
          'LinkedIn-Version': VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author,
          commentary,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      })

      if (!res.ok) {
        return failed(await readError(res), isRetryableStatus(res.status))
      }

      // The post URN comes back in a header, not the body.
      const urn = res.headers.get('x-restli-id') ?? undefined
      return {
        kind: 'posted',
        externalId: urn,
        externalUrl: urn ? `https://www.linkedin.com/feed/update/${urn}/` : undefined,
        note:
          payload.linkUrl && payload.linkPlacement === 'first_comment'
            ? `Post is live. Add this link as the first comment yourself: ${payload.linkUrl}`
            : undefined,
      }
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e), true)
    }
  },
}
