import type { Metadata } from 'next'
import Link from 'next/link'
import { passwordHash } from '@/lib/auth'
import { SignOut } from '@/components/sign-out'
import './globals.css'

export const metadata: Metadata = {
  title: 'PR Agent',
  description: 'Local launch planning for side projects',
}

const NAV = [
  { href: '/', label: 'Projects' },
  { href: '/checklist', label: 'Checklist' },
  { href: '/performance', label: 'Performance' },
  { href: '/channels', label: 'Channels' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-edge bg-panel">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
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
            {passwordHash() ? <SignOut /> : <span className="text-xs text-muted">local</span>}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
