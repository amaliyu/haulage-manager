import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'

const control =
  'w-full rounded border bg-panel px-3 text-body text-ink placeholder:text-ink-3 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3'

function border(invalid?: boolean) {
  return invalid ? 'border-danger' : 'border-line'
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; prefix?: string }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, prefix, ...rest },
  ref,
) {
  if (prefix) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-2" aria-hidden>
          {prefix}
        </span>
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(control, 'h-input pl-8', border(invalid), className)}
          {...rest}
        />
      </div>
    )
  }
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(control, 'h-input', border(invalid), className)}
      {...rest}
    />
  )
})

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, 'h-input appearance-none pr-8', border(invalid), className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={20}
        strokeWidth={1.5}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
    </div>
  )
})

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(control, 'py-2', border(invalid), className)}
      {...rest}
    />
  )
})
