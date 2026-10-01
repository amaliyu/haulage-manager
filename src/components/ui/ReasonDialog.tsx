import { useEffect, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Field } from './Field'
import { Textarea } from './Input'
import { Modal } from './Modal'

/**
 * Destructive action that needs a written reason (cancel a trip, cancel an
 * order). The confirm button stays disabled until a reason is typed.
 */
export function ReasonDialog({
  open,
  title,
  message,
  reasonLabel = 'Reason',
  confirmLabel,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  reasonLabel?: string
  confirmLabel: string
  loading?: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])
  const ok = reason.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button variant="danger" block loading={loading} disabled={!ok} onClick={() => onConfirm(reason.trim())} className="md:w-auto">
            {confirmLabel}
          </Button>
          <Button variant="secondary" block onClick={onClose} disabled={loading} className="md:w-auto">
            Keep as is
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-body text-ink-2">{message}</div>
        <Field label={reasonLabel} required>
          {(p) => (
            <Textarea
              id={p.id}
              aria-describedby={p.describedBy}
              rows={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
