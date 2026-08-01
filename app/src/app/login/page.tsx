import { redirect } from 'next/navigation'
import { verifyPassword } from '@/lib/crypto'
import { getSession } from '@/lib/session'
import { env } from '@/env'
import { Button, Field, inputClass } from '@/components/ui'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  async function login(formData: FormData) {
    'use server'
    const password = String(formData.get('password') ?? '')
    if (!verifyPassword(password, env().ADMIN_PASSWORD_HASH)) {
      redirect('/login?error=1')
    }
    const session = await getSession()
    session.loggedIn = true
    await session.save()
    redirect('/')
  }

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">PR Agent</h1>
      <p className="mb-6 text-sm text-muted">Your personal launch dashboard.</p>
      <form action={login} className="space-y-4">
        <Field label="Password">
          <input
            type="password"
            name="password"
            autoFocus
            required
            className={inputClass}
          />
        </Field>
        {error && <p className="text-sm text-bad">Incorrect password.</p>}
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  )
}
