import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Banknote } from 'lucide-react'
import { Button, FormGrid, Modal, NairaField, SelectField, TextareaField, TextField, useToast } from '@/components/ui'
import { formatNaira } from '@/lib/format'
import { naira, optionalText } from '@/lib/zod'
import { PAYMENT_METHODS, type PaymentMethod } from '@/services/orders'
import { useRecordPayment } from './api'
import { PAYMENT_METHOD_LABEL } from './labels'

/** "2026-09-30T14:05" in the device's local time (Lagos on staff phones). */
function localNow() {
  const d = new Date()
  d.setSeconds(0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function RecordPaymentModal({
  open,
  onClose,
  order,
}: {
  open: boolean
  onClose: () => void
  order: { id: string; order_number: string; total: number }
}) {
  const toast = useToast()
  const record = useRecordPayment()
  const schema = z
    .object({
      amount: naira('Amount', { allowZero: false }),
      method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], { errorMap: () => ({ message: 'Choose how it was paid' }) }),
      bank_reference: optionalText(80),
      received_at: z
        .string()
        .min(1, 'Enter when the payment was received')
        .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Enter a valid date and time')
        .refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60_000, 'Cannot be in the future'),
      note: optionalText(300),
    })
    .refine((v) => v.amount >= order.total, { path: ['amount'], message: `Prepaid orders are paid in full: at least ${formatNaira(order.total)}` })
    .refine((v) => v.method === 'cash' || v.bank_reference !== null, { path: ['bank_reference'], message: 'Enter the bank or POS reference' })
  type In = z.input<typeof schema>
  type Out = z.output<typeof schema>

  const defaults = (): In => ({ amount: String(order.total), method: 'bank_transfer', bank_reference: '', received_at: localNow(), note: '' })
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(schema), defaultValues: defaults() })
  useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.total])

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await record.mutateAsync({
        orderId: order.id,
        amount: v.amount,
        method: v.method,
        bankReference: v.bank_reference,
        receivedAt: new Date(v.received_at).toISOString(),
        note: v.note,
      })
      toast.success(`Payment of ${formatNaira(v.amount)} recorded. ${order.order_number} is ready to dispatch.`)
      onClose()
    } catch (err) {
      toast.error(err, 'Could not record the payment.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record payment: ${order.order_number}`}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" form="payment-form" block className="md:w-auto" loading={record.isPending} icon={<Banknote size={20} strokeWidth={1.5} aria-hidden />}>
            Record payment
          </Button>
          <Button variant="secondary" block className="md:w-auto" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="payment-form" noValidate onSubmit={onSubmit}>
        <p className="mb-4 text-small text-ink-2">
          Order total <span className="num font-semibold text-ink">{formatNaira(order.total)}</span>. Recording the payment unlocks
          dispatch for this order.
        </p>
        <FormGrid>
          <NairaField form={form} name="amount" label="Amount received" required />
          <SelectField
            form={form}
            name="method"
            label="Method"
            required
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
          />
          <TextField form={form} name="bank_reference" label="Bank or POS reference" hint="Not needed for cash." autoComplete="off" />
          <TextField form={form} name="received_at" label="Received at" type="datetime-local" required />
          <TextareaField form={form} name="note" label="Note" rows={2} />
        </FormGrid>
      </form>
    </Modal>
  )
}
