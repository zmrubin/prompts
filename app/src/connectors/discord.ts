import type { Connector, Creds, PostPayload, PostResult } from './types'
import { composeBody, failed, isRetryableStatus, readError } from './types'

export const discordConnector: Connector = {
  key: 'discord',
  name: 'Discord',
  mode: 'auto',
  setupNote:
    'Free, no approval needed. In your server: Channel Settings → Integrations → Webhooks → New Webhook, then copy the URL. It posts to that one channel only.',
  credentialFields: [
    {
      key: 'webhookUrl',
      label: 'Webhook URL',
      secret: true,
      placeholder: 'https://discord.com/api/webhooks/...',
    },
  ],

  async verify(creds) {
    try {
      // GET on a webhook URL returns its metadata without posting anything.
      const res = await fetch(creds.webhookUrl)
      if (!res.ok) return { ok: false, error: await readError(res) }
      const hook = (await res.json()) as { name: string; channel_id: string }
      return { ok: true, handle: hook.name, meta: { channelId: hook.channel_id } }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async publish(payload: PostPayload, creds: Creds, opts): Promise<PostResult> {
    const content = composeBody(payload)
    const limit = payload.channel.charLimit ?? 2000

    if (content.length > limit) {
      return failed(`Message is ${content.length} characters; Discord's limit is ${limit}.`)
    }

    if (opts.dryRun) {
      return {
        kind: 'posted',
        externalUrl: 'https://discord.com/dry-run',
        note: `DRY RUN — would send ${content.length} chars to the Discord webhook.`,
      }
    }

    try {
      // ?wait=true makes Discord return the created message instead of 204.
      const res = await fetch(`${creds.webhookUrl}?wait=true`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) {
        return failed(await readError(res), isRetryableStatus(res.status))
      }
      const msg = (await res.json()) as { id: string; channel_id: string }
      return { kind: 'posted', externalId: msg.id }
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e), true)
    }
  },
}
