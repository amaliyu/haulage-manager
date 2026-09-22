import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from './cn'
import { EmptyState, ErrorState } from './EmptyState'

export type Column<T> = {
  key: string
  header: string
  /** Money and quantities are right-aligned. */
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
  className?: string
}

export type MobileLayout<T> = {
  /** Identity: bold first line. */
  title: (row: T) => ReactNode
  /** Secondary lines under the title. */
  lines?: (row: T) => ReactNode
  /** Key figure shown large on the right. */
  figure?: (row: T) => ReactNode
  /** Small caption under the figure (e.g. a status pill). */
  figureCaption?: (row: T) => ReactNode
  /** Row actions shown under the block (full-width buttons). */
  actions?: (row: T) => ReactNode
}

type Props<T> = {
  rows: T[] | undefined
  columns: Column<T>[]
  mobile: MobileLayout<T>
  rowKey: (row: T) => string
  rowHref?: (row: T) => string | undefined
  isLoading: boolean
  isError: boolean
  error?: unknown
  onRetry: () => void
  /** What the list is, for the error message ("customers"). */
  noun: string
  emptyMessage: string
  emptyAction?: ReactNode
  caption?: string
  skeletonRows?: number
}

/**
 * The core list primitive. A dense 40px-row table from md up; below md each
 * row becomes a bordered block with the key figure large on the right. It
 * never scrolls horizontally.
 */
export function DataTable<T>({
  rows,
  columns,
  mobile,
  rowKey,
  rowHref,
  isLoading,
  isError,
  error,
  onRetry,
  noun,
  emptyMessage,
  emptyAction,
  caption,
  skeletonRows = 6,
}: Props<T>) {
  if (isError) return <ErrorState what={`Could not load ${noun}.`} error={error} onRetry={onRetry} />
  if (!isLoading && rows && rows.length === 0) return <EmptyState message={emptyMessage} action={emptyAction} />

  const loading = isLoading || !rows
  return (
    <>
      {/* Phones: stacked blocks */}
      <ul className="flex flex-col gap-2 md:hidden" aria-busy={loading || undefined} aria-label={caption ?? noun}>
        {loading
          ? Array.from({ length: skeletonRows }, (_, i) => (
              <li key={i} className="flex min-h-[72px] items-center justify-between gap-3 rounded-panel border border-line bg-panel p-3" aria-hidden>
                <div className="flex w-3/5 flex-col gap-2">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-3 w-2/3" />
                </div>
                <div className="skeleton h-6 w-1/4" />
              </li>
            ))
          : rows.map((row) => {
              const href = rowHref?.(row)
              const inner = (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink">{mobile.title(row)}</div>
                    {mobile.lines && <div className="mt-1 flex flex-col gap-1 text-small text-ink-2">{mobile.lines(row)}</div>}
                  </div>
                  {(mobile.figure || mobile.figureCaption) && (
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      {mobile.figure && <div className="num font-display text-section font-bold text-ink">{mobile.figure(row)}</div>}
                      {mobile.figureCaption?.(row)}
                    </div>
                  )}
                  {href && <ChevronRight size={20} strokeWidth={1.5} className="shrink-0 text-ink-3" aria-hidden />}
                </>
              )
              const cls = 'flex min-h-[72px] items-center gap-3 p-3'
              const actions = mobile.actions?.(row)
              return (
                <li key={rowKey(row)} className="rounded-panel border border-line bg-panel">
                  {href ? (
                    <Link to={href} className={cn(cls, 'rounded-panel no-underline active:bg-surface-2')}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                  {actions && <div className="flex flex-col gap-2 border-t border-line p-3">{actions}</div>}
                </li>
              )
            })}
      </ul>

      {/* md and up: dense table */}
      <div className="hidden rounded-panel border border-line bg-panel md:block">
        <table className="w-full border-collapse text-body">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'micro-label sticky top-header z-[1] h-row border-b border-line bg-surface-2 px-3 first:rounded-tl-panel last:rounded-tr-panel',
                    c.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {c.header}
                </th>
              ))}
              {rowHref && <th scope="col" className="sticky top-header z-[1] w-touch border-b border-line bg-surface-2 last:rounded-tr-panel"><span className="sr-only">Open</span></th>}
            </tr>
          </thead>
          <tbody aria-busy={loading || undefined}>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={i} className="h-row border-b border-line last:border-b-0" aria-hidden>
                    {columns.map((c) => (
                      <td key={c.key} className="px-3">
                        <div className={cn('skeleton h-3', c.align === 'right' ? 'ml-auto w-1/2' : 'w-3/4')} />
                      </td>
                    ))}
                    {rowHref && <td />}
                  </tr>
                ))
              : rows.map((row) => {
                  const href = rowHref?.(row)
                  return (
                    <tr key={rowKey(row)} className="h-row border-b border-line last:border-b-0 hover:bg-surface-2">
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn('px-3 py-2', c.align === 'right' && 'num text-right', c.className)}
                        >
                          {c.render(row)}
                        </td>
                      ))}
                      {href && (
                        <td className="w-touch pr-1 text-right">
                          <Link
                            to={href}
                            className="inline-flex h-row w-touch items-center justify-center rounded text-ink-3 hover:text-ink"
                            aria-label="Open"
                          >
                            <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
                          </Link>
                        </td>
                      )}
                      {rowHref && !href && <td />}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </>
  )
}
