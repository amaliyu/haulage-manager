import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from './cn'

export function MetricTile({
  label,
  value,
  context,
  to,
  loading,
  emphasis,
}: {
  label: string
  value: ReactNode
  context?: ReactNode
  to?: string
  loading?: boolean
  /** 2px brand left border for the figure that matters most. */
  emphasis?: boolean
}) {
  const body = (
    <>
      <p className="micro-label">{label}</p>
      {loading ? (
        <div className="skeleton mt-2 h-8 w-3/4" aria-hidden />
      ) : (
        <p className="num mt-1 break-words font-display text-metric font-bold">{value}</p>
      )}
      {context && <p className="mt-1 text-small text-ink-3">{context}</p>}
    </>
  )
  const cls = cn('block min-w-0 rounded-panel border border-line bg-panel p-4', emphasis && 'border-l-2 border-l-brand')
  return to ? (
    <Link to={to} className={cn(cls, 'no-underline hover:border-ink-3')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
