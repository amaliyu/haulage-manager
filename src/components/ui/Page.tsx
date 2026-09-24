import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import { cn } from './cn'

export function PageHeader({
  title,
  action,
  back,
  meta,
}: {
  title: ReactNode
  action?: ReactNode
  back?: { to: string; label: string }
  meta?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      {back && (
        <Link
          to={back.to}
          className="-ml-2 inline-flex min-h-touch w-fit items-center gap-1 rounded px-2 text-small font-medium text-ink-2 underline-offset-4 hover:underline"
        >
          <ArrowLeft size={16} strokeWidth={1.5} aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-title">{title}</h1>
          {meta && <div className="mt-1 flex flex-wrap items-center gap-2 text-small text-ink-2">{meta}</div>}
        </div>
        {action && <div className="flex shrink-0 gap-2">{action}</div>}
      </div>
    </div>
  )
}

export function FilterPills<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V
  options: { value: V; label: string }[]
  onChange: (v: V) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-touch rounded border px-3 font-display text-small font-semibold',
              on ? 'border-ink bg-ink text-surface' : 'border-line bg-panel text-ink-2 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
}) {
  return (
    <div className="relative">
      <Search size={20} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-touch w-full rounded border border-line bg-panel pl-8 pr-12 text-body text-ink placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-0 top-0 flex h-touch w-touch items-center justify-center text-ink-3 hover:text-ink"
        >
          <X size={20} strokeWidth={1.5} aria-hidden />
        </button>
      )}
    </div>
  )
}

/** Label/value facts: one column on phones, two from sm. */
export function Facts({ items }: { items: { label: string; value: ReactNode; numeric?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 flex-col gap-1">
          <dt className="micro-label">{it.label}</dt>
          <dd className={cn('break-words text-body text-ink', it.numeric && 'num')}>{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

/** Form actions: stacked full-width on phones, right-aligned row from md. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col gap-3 md:flex-row-reverse md:justify-start">{children}</div>
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
