import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './Button'

/**
 * Bottom sheet on phones, dialog from md up. The only surface (with Toast and
 * the More sheet) allowed to use the overlay shadow.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  dismissible?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')
    ;(first ?? panelRef.current)?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose, dismissible])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-overlay flex items-end justify-center md:items-center md:p-6">
      <div className="scrim absolute inset-0" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col rounded-panel rounded-b-none border border-line bg-panel shadow-overlay md:max-w-[560px] md:rounded-panel"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line py-1 pl-4 pr-1">
          <h2 id={titleId} className="text-section font-semibold">
            {title}
          </h2>
          {dismissible && (
            <Button variant="ghost" data-close aria-label="Close" onClick={onClose} className="px-3">
              <X size={20} strokeWidth={1.5} aria-hidden />
            </Button>
          )}
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <footer className="border-t border-line p-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  tone = 'danger',
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button variant={tone} block loading={loading} onClick={onConfirm} className="md:w-auto">
            {confirmLabel}
          </Button>
          <Button variant="secondary" block onClick={onClose} disabled={loading} className="md:w-auto">
            Keep as is
          </Button>
        </div>
      }
    >
      <div className="text-body text-ink-2">{message}</div>
    </Modal>
  )
}
