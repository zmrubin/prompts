import type { Connector, Creds, PostPayload, PostResult } from './types'
import { failed, isRetryableStatus, readError } from './types'

const GRAPH = 'https://graph.instagram.com/v21.0'

export const instagramConnector: Connector = {
  key: 'instagram',
  name: 'Instagram',
  mode: 'auto',
  setupNote:
    'Longest lead time of any channel. Requires an Instagram Business account (Creator accounts cannot publish via API), a linked Facebook Page, a Meta app, and separate app review for instagram_business_basic and instagram_business_content_publish — roughly 2-4 weeks with a screencast per permission. Hard cap of 25 published posts per 24 hours. Images must be publicly reachable URLs; Instagram fetches them, so a local file will not work.',
  credentialFields: [
    { key: 'igUserId', label: 'Instagram Business account ID' },
    {
      key: 'accessToken',
      label: 'Long-lived access token',
      secret: true,
      help: 'Needs instagram_business_content_publish.',
    },
  ],

  async verify(creds) {
    try {
      const res = await fetch(
        `${GRAPH}/${creds.igUserId}?fields=username,account_type&access_token=${creds.accessToken}`,
      )
      if (!res.ok) return { ok: false, error: await readError(res) }
      const me = (await res.json()) as { username: string; account_type?: string }
      return { ok: true, handle: `@${me.username}`, meta: { type: me.account_type } }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async publish(payload: PostPayload, creds: Creds, opts): Promise<PostResult> {
    const image = payload.imageUrls?.[0]
    if (!image) {
      return failed(
        'Instagram has no text-only post. Add a publicly reachable image URL to this draft.',
      )
    }

    // Links are never clickable in a caption, so appending one is pure noise.
    const caption = payload.body
    const limit = payload.channel.charLimit ?? 2200
    if ([...caption].length > limit) {
      return failed(
        `Caption is ${[...caption].length} characters; Instagram's limit is ${limit}.`,
      )
    }

    if (opts.dryRun) {
      return {
        kind: 'posted',
        externalUrl: 'https://instagram.com/dry-run',
        note: `DRY RUN — would create a media container for ${image} and publish it.`,
      }
    }

    try {
      // Step 1: create the container.
      const create = await fetch(`${GRAPH}/${creds.igUserId}/media`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          image_url: image,
          caption,
          access_token: creds.accessToken,
        }),
      })
      if (!create.ok) {
        return failed(await readError(create), isRetryableStatus(create.status))
      }
      const { id: creationId } = (await create.json()) as { id: string }

      // Step 2: publish it.
      const publish = await fetch(`${GRAPH}/${creds.igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: creds.accessToken,
        }),
      })
      if (!publish.ok) {
        return failed(await readError(publish), isRetryableStatus(publish.status))
      }
      const { id } = (await publish.json()) as { id: string }
      return { kind: 'posted', externalId: id }
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e), true)
    }
  },
}
