import { useId, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from './cn'

type FieldRenderProps = { id: string; describedBy?: string; invalid: boolean }

export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: (p: FieldRenderProps) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [hint && hintId, error && errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="micro-label">
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-small text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="flex items-start gap-1 text-small font-medium text-danger">
          <AlertCircle size={16} strokeWidth={1.5} className="mt-px shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
