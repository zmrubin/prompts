import type { Metadata } from 'next'
import Link from 'next/link'
import { isAuthed } from '@/lib/session'
import './globals.css'

export const metadata: Metadata = {
  title: 'PR Agent',
  description: 'Personal launch and distribution dashboard',
}

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/queue', label: 'Queue' },
  { href: '/channels', label: 'Channels' },
  { href: '/settings', label: 'Settings' },
]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthed()

  return (
    <html lang="en">
      <body className="min-h-screen">
        {authed && (
          <header className="border-b border-edge bg-panel">
            <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
              <Link href="/" className="font-semibold tracking-tight">
                PR&nbsp;Agent
              </Link>
              <div className="flex flex-1 gap-5 text-sm">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="text-muted hover:text-white">
                    {n.label}
                  </Link>
                ))}
              </div>
              <form action="/api/auth/logout" method="post">
                <button className="text-sm text-muted hover:text-white">Sign out</button>
              </form>
            </nav>
          </header>
        )}
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
