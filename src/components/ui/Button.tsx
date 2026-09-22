import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type Common = {
  variant?: ButtonVariant
  /** Full width on every screen size (driver-facing and form actions on phones). */
  block?: boolean
  icon?: ReactNode
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded px-4 font-display text-body font-semibold ' +
  'min-h-touch min-w-touch select-none whitespace-nowrap border transition-colors ' +
  'disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-ink-3'

const variants: Record<ButtonVariant, string> = {
  primary: 'h-cta md:h-touch border-brand bg-brand text-white hover:border-brand-ink hover:bg-brand-ink active:bg-brand-ink',
  secondary: 'h-touch border-line bg-panel text-ink hover:bg-surface-2 active:bg-surface-2',
  ghost: 'h-touch border-transparent bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink disabled:border-transparent disabled:bg-transparent',
  danger: 'h-cta md:h-touch border-danger bg-danger text-on-danger',
}

export function buttonClasses(variant: ButtonVariant = 'primary', block?: boolean, className?: string) {
  return cn(base, variants[variant], block && 'w-full', className)
}

export type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', block, icon, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, block, className)}
      {...rest}
    >
      {loading ? <Loader2 size={20} strokeWidth={1.5} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export function ButtonLink({
  variant = 'primary',
  block,
  icon,
  className,
  children,
  ...rest
}: Common & LinkProps) {
  return (
    <Link className={buttonClasses(variant, block, cn('no-underline', className))} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
