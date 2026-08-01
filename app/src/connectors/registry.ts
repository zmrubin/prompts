import type { Connector } from './types'
import { blueskyConnector } from './bluesky'
import { mastodonConnector } from './mastodon'
import { devtoConnector } from './devto'
import { discordConnector } from './discord'
import { telegramConnector } from './telegram'
import { xConnector } from './x'
import { redditConnector } from './reddit'
import { linkedinConnector } from './linkedin'
import { instagramConnector } from './instagram'
import { manualConnector } from './manual'

export const CONNECTORS: Record<string, Connector> = {
  bluesky: blueskyConnector,
  mastodon: mastodonConnector,
  devto: devtoConnector,
  discord: discordConnector,
  telegram: telegramConnector,
  x: xConnector,
  reddit: redditConnector,
  linkedin: linkedinConnector,
  instagram: instagramConnector,
  manual: manualConnector,
}

/** Connectors that can post today with no approval and no cost. */
export const ZERO_APPROVAL = ['bluesky', 'mastodon', 'devto', 'discord', 'telegram']

export function getConnector(key: string | null | undefined): Connector {
  if (!key) return manualConnector
  return CONNECTORS[key] ?? manualConnector
}

/** Ordered for the Settings page: easiest to hardest to set up. */
export function connectableConnectors(): Connector[] {
  return [
    ...ZERO_APPROVAL.map((k) => CONNECTORS[k]),
    CONNECTORS.x,
    CONNECTORS.reddit,
    CONNECTORS.linkedin,
    CONNECTORS.instagram,
  ]
}
