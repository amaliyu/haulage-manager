import { cn } from './cn'

export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'neutral'

/** Always carries the status word — colour never carries meaning alone. */
export function StatusPill({ tone = 'neutral', children, className }: { tone?: StatusTone; children: string; className?: string }) {
  return <span className={cn('pill', `pill-${tone}`, className)}>{children}</span>
}

export function ActivePill({ active }: { active: boolean }) {
  return <StatusPill tone={active ? 'ok' : 'neutral'}>{active ? 'Active' : 'Inactive'}</StatusPill>
}
