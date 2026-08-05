'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setBusy(false)
    if (res.ok) {
      router.push(params.get('next') || '/')
      router.refresh()
      return
    }
    setError(res.status === 401 ? 'That password is not right.' : 'Something went wrong.')
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">PR Agent</h1>
      <p className="text-sm text-muted">Sign in to see your launch plans.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoFocus
        autoComplete="current-password"
        className="w-full rounded border border-edge bg-panel px-3 py-2 text-sm outline-none focus:border-white/40"
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !password}
        className="w-full rounded bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-40"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to keep the page statically
  // renderable rather than opting the whole route into dynamic rendering.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
