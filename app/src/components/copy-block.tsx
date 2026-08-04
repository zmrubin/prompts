'use client'

import { useState } from 'react'

/**
 * The core interaction of the whole app: get this text onto the clipboard
 * with one click, then open the place it goes. Everything else is support.
 */
export function CopyButton({
  text,
  label = 'Copy',
  big = false,
}: {
  text: string
  label?: string
  big?: boolean
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('ok')
    } catch {
      // Clipboard API needs a secure context; localhost qualifies, but a
      // non-localhost LAN address over http does not.
      setState('err')
    }
    setTimeout(() => setState('idle'), 1800)
  }

  const cls = big
    ? 'rounded-md bg-accent px-3 py-2 text-sm font-medium text-ink transition hover:opacity-90'
    : 'rounded-md border border-edge px-2.5 py-1.5 text-xs text-muted transition hover:text-white'

  return (
    <button onClick={copy} className={cls} type="button">
      {state === 'ok' ? 'Copied' : state === 'err' ? 'Press ⌘C' : label}
    </button>
  )
}
