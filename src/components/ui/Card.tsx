import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

/** A flat bordered panel. Never nest a Card inside a Card. */
export function Card({
  title,
  action,
  emphasis,
  className,
  children,
  padded = true,
  ...rest
}: {
  title?: ReactNode
  action?: ReactNode
  /** 2px brand left border for the one thing on the screen that matters most. */
  emphasis?: boolean
  padded?: boolean
} & Omit<HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section
      className={cn(
        'rounded-panel border border-line bg-panel',
        emphasis && 'border-l-2 border-l-brand',
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <header className="flex min-h-touch items-center justify-between gap-3 border-b border-line px-4 py-2">
          {title && <h2 className="text-section font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      <div className={cn(padded && 'p-4')}>{children}</div>
    </section>
  )
}
