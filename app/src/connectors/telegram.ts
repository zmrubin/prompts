import type { Connector, Creds, PostPayload, PostResult } from './types'
import { composeBody, failed, isRetryableStatus, readError } from './types'

export const telegramConnector: Connector = {
  key: 'telegram',
  name: 'Telegram',
  mode: 'auto',
  setupNote:
    'Free, no approval needed. Create a bot via @BotFather, then add it as an admin of your channel. Chat ID looks like @yourchannel or a numeric -100… id.',
  credentialFields: [
    { key: 'botToken', label: 'Bot token', secret: true },
    { key: 'chatId', label: 'Chat / channel ID', placeholder: '@yourchannel' },
  ],

  async verify(creds) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${creds.botToken}/getMe`)
      if (!res.ok) return { ok: false, error: await readError(res) }
      const data = (await res.json()) as { result: { username: string } }
      return { ok: true, handle: `@${data.result.username}` }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  async publish(payload: PostPayload, creds: Creds, opts): Promise<PostResult> {
    const text = composeBody(payload)
    const limit = payload.channel.charLimit ?? 4096

    if (text.length > limit) {
      return failed(`Message is ${text.length} characters; Telegram's limit is ${limit}.`)
    }

    if (opts.dryRun) {
      return {
        kind: 'posted',
        externalUrl: 'https://t.me/dry-run',
        note: `DRY RUN — would send ${text.length} chars to ${creds.chatId}.`,
      }
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${creds.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: creds.chatId,
          text,
          disable_web_page_preview: false,
        }),
      })

      if (!res.ok) {
        return failed(await readError(res), isRetryableStatus(res.status))
      }
      const data = (await res.json()) as {
        result: { message_id: number; chat: { username?: string } }
      }
      const username = data.result.chat.username
      return {
        kind: 'posted',
        externalId: String(data.result.message_id),
        externalUrl: username
          ? `https://t.me/${username}/${data.result.message_id}`
          : undefined,
      }
    } catch (e) {
      return failed(e instanceof Error ? e.message : String(e), true)
    }
  },
}
