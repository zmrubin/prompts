'use client'

import { useRouter } from 'next/navigation'

export function SignOut() {
  const router = useRouter()
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
        router.refresh()
      }}
      className="text-xs text-muted hover:text-white"
    >
      Sign out
    </button>
  )
}
