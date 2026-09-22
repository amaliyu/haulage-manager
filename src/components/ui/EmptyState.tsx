import type { ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from './Button'
import { toAppError } from '@/lib/errors'

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-body text-ink-2">{message}</p>
      {action}
    </div>
  )
}

export function ErrorState({ what, error, onRetry }: { what: string; error?: unknown; onRetry?: () => void }) {
  const detail = error ? toAppError(error).message : undefined
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-panel border border-line border-l-2 border-l-danger bg-panel p-4"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={20} strokeWidth={1.5} className="mt-px shrink-0 text-danger" aria-hidden />
        <div>
          <p className="font-semibold text-ink">{what}</p>
          {detail && <p className="text-small text-ink-2">{detail}</p>}
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" icon={<RotateCw size={20} strokeWidth={1.5} aria-hidden />} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
