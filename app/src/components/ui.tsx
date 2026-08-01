import Link from 'next/link'

export function Card({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <div id={id} className={`rounded-lg border border-edge bg-panel p-5 ${className}`}>
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
}) {
  const styles = {
    primary: 'bg-accent text-ink hover:opacity-90',
    ghost: 'border border-edge text-muted hover:text-white',
    danger: 'border border-bad/40 text-bad hover:bg-bad/10',
  }[variant]
  return (
    <button
      {...props}
      className={`rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${styles} ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-ink transition hover:opacity-90"
    >
      {children}
    </Link>
  )
}

const TONE = {
  neutral: 'bg-edge text-muted',
  good: 'bg-good/15 text-good',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  accent: 'bg-accent/15 text-accent',
} as const

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: keyof typeof TONE
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-edge p-8 text-center text-sm text-muted">
      {children}
    </div>
  )
}

export function Field({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-muted">{help}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-accent'

/** Maps a scheduled_posts status to a badge tone + human label. */
export function statusBadge(status: string) {
  const map: Record<string, { tone: keyof typeof TONE; label: string }> = {
    scheduled: { tone: 'accent', label: 'Scheduled' },
    processing: { tone: 'warn', label: 'Posting…' },
    posted: { tone: 'good', label: 'Posted' },
    failed: { tone: 'bad', label: 'Failed' },
    skipped: { tone: 'neutral', label: 'Skipped' },
    manual_pending: { tone: 'warn', label: 'Needs you' },
    manual_done: { tone: 'good', label: 'Posted by you' },
  }
  return map[status] ?? { tone: 'neutral' as const, label: status }
}
