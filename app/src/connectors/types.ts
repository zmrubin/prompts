import type { Channel } from '@/db/schema'

export type Creds = Record<string, string>

export type PostPayload = {
  channel: Channel
  title?: string | null
  body: string
  linkUrl?: string | null
  linkPlacement: 'body' | 'first_comment' | 'none'
  imageUrls?: string[]
}

export type PostResult =
  | { kind: 'posted'; externalId?: string; externalUrl?: string; note?: string }
  /** No write API. The UI hands the user copy plus a prefilled submit URL. */
  | { kind: 'manual'; submitUrl: string; clipboard: string }
  | { kind: 'failed'; error: string; retryable: boolean }

export type VerifyResult = {
  ok: boolean
  handle?: string
  error?: string
  meta?: Record<string, unknown>
}

export type CredentialField = {
  key: string
  label: string
  help?: string
  secret?: boolean
  placeholder?: string
}

export interface Connector {
  key: string
  name: string
  mode: 'auto' | 'manual'
  /** Drives the connect form in Settings. */
  credentialFields: readonly CredentialField[]
  /** Honest, user-facing note about cost or approval requirements. */
  setupNote?: string
  verify(creds: Creds): Promise<VerifyResult>
  publish(
    payload: PostPayload,
    creds: Creds,
    opts: { dryRun: boolean },
  ): Promise<PostResult>
}

/** Connectors throw this for errors that are worth retrying later. */
export class RetryableError extends Error {
  retryable = true
}

export function failed(error: string, retryable = false): PostResult {
  return { kind: 'failed', error, retryable }
}

/**
 * Treats 429 and 5xx as transient; everything else is a real rejection that
 * will fail identically on retry.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  return `HTTP ${res.status}${text ? `: ${text.slice(0, 400)}` : ''}`
}

/**
 * Renders body + link according to the venue's link policy. Centralised so
 * every connector applies the same rule and nothing accidentally buries a
 * link where the platform will punish it.
 */
export function composeBody(p: PostPayload): string {
  if (!p.linkUrl || p.linkPlacement !== 'body') return p.body
  return p.body.includes(p.linkUrl) ? p.body : `${p.body}\n\n${p.linkUrl}`
}

export function fillTemplate(
  template: string,
  vars: { url?: string | null; title?: string | null; repo?: string | null },
): string {
  return template
    .replace('{url}', encodeURIComponent(vars.url ?? ''))
    .replace('{title}', encodeURIComponent(vars.title ?? ''))
    .replace('{repo}', vars.repo ?? '')
}
