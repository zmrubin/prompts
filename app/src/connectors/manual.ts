import type { Connector, PostPayload, PostResult } from './types'
import { fillTemplate } from './types'

/**
 * The fallback for every venue with no write API — Hacker News, Product Hunt,
 * and all the directories.
 *
 * It satisfies the same interface as a real connector, so the scheduler and
 * the UI never branch on "can this be automated". Instead of posting, it
 * returns the copy plus a prefilled submit URL, and the scheduled post lands
 * in the "Needs you" queue.
 */
export const manualConnector: Connector = {
  key: 'manual',
  name: 'Manual',
  mode: 'manual',
  credentialFields: [],

  async verify() {
    return { ok: true, handle: 'manual' }
  },

  async publish(payload: PostPayload): Promise<PostResult> {
    const template = payload.channel.submitUrlTemplate ?? payload.channel.homepageUrl ?? ''
    const submitUrl = fillTemplate(template, {
      url: payload.linkUrl,
      title: payload.title,
    })

    const clipboard = [payload.title, payload.body, payload.linkUrl]
      .filter(Boolean)
      .join('\n\n')

    return { kind: 'manual', submitUrl, clipboard }
  },
}
