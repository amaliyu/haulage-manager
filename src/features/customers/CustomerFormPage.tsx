import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save } from 'lucide-react'
import {
  Button,
  ButtonLink,
  Card,
  ErrorState,
  FormActions,
  FormGrid,
  PageHeader,
  SelectField,
  SkeletonBlock,
  TextField,
  TextareaField,
  useToast,
} from '@/components/ui'
import { optionalPhone, optionalText, phone, requiredText, wholeNumber } from '@/lib/zod'
import type { Customer } from '@/services/customers'
import { useCustomer, useSaveCustomer } from './api'

const schema = z
  .object({
    name: requiredText('Name', 160),
    phone: phone('Phone'),
    alt_phone: optionalPhone('Alternative phone'),
    customer_type: z.enum(['company', 'individual'], { message: 'Choose a customer type' }),
    payment_terms: z.enum(['prepaid', 'credit'], { message: 'Choose payment terms' }),
    credit_load_cap: wholeNumber('Credit cap', { max: 1000 }),
    credit_days: wholeNumber('Credit days', { max: 365 }),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.payment_terms === 'prepaid') return
    if (v.credit_load_cap < 1) ctx.addIssue({ code: 'custom', path: ['credit_load_cap'], message: 'Credit customers need a cap of at least 1 load' })
    if (v.credit_days < 1) ctx.addIssue({ code: 'custom', path: ['credit_days'], message: 'Credit customers need at least 1 credit day' })
  })
  .transform((v) => (v.payment_terms === 'prepaid' ? { ...v, credit_load_cap: 0, credit_days: 0 } : v))

type In = z.input<typeof schema>
type Out = z.output<typeof schema>

function toForm(c?: Customer): In {
  return {
    name: c?.name ?? '',
    phone: c?.phone ?? '',
    alt_phone: c?.alt_phone ?? '',
    customer_type: (c?.customer_type as In['customer_type']) ?? 'company',
    payment_terms: (c?.payment_terms as In['payment_terms']) ?? 'prepaid',
    credit_load_cap: String(c?.credit_load_cap ?? 0),
    credit_days: String(c?.credit_days ?? 0),
    notes: c?.notes ?? '',
  }
}

export function CustomerFormPage() {
  const { id } = useParams()
  const q = useCustomer(id)
  if (id && q.isLoading) {
    return (
      <>
        <PageHeader title="Edit customer" back={{ to: `/customers/${id}`, label: 'Customer' }} />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonBlock key={i} className="h-input w-full" />
          ))}
        </div>
      </>
    )
  }
  if (id && q.isError) return <ErrorState what="Could not load this customer." error={q.error} onRetry={() => void q.refetch()} />
  return <CustomerForm customer={q.data} />
}

function CustomerForm({ customer }: { customer?: Customer }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveCustomer()
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(schema), defaultValues: toForm(customer) })
  const terms = form.watch('payment_terms')
  const prepaid = terms === 'prepaid'

  // Credit fields lock at 0 for prepaid customers.
  useEffect(() => {
    if (prepaid) {
      form.setValue('credit_load_cap', '0', { shouldValidate: form.formState.isSubmitted })
      form.setValue('credit_days', '0', { shouldValidate: form.formState.isSubmitted })
    }
  }, [prepaid, form])

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const row = await save.mutateAsync({ id: customer?.id, input: v })
      toast.success(customer ? 'Customer saved.' : `Customer ${row.name} created.`)
      navigate(`/customers/${row.id}`, { replace: true })
    } catch (err) {
      toast.error(err, 'Could not save the customer.')
    }
  })

  const backTo = customer ? `/customers/${customer.id}` : '/customers'
  return (
    <>
      <PageHeader
        title={customer ? `Edit ${customer.name}` : 'New customer'}
        back={{ to: backTo, label: customer ? 'Customer' : 'Customers' }}
      />
      <form noValidate onSubmit={onSubmit} className="max-w-[720px]">
        <Card>
          <FormGrid cols={2}>
            <TextField form={form} name="name" label="Name" required autoComplete="organization" className="md:col-span-2" />
            <TextField form={form} name="phone" label="Phone" required type="tel" inputMode="tel" autoComplete="tel" />
            <TextField form={form} name="alt_phone" label="Alternative phone" type="tel" inputMode="tel" />
            <SelectField
              form={form}
              name="customer_type"
              label="Customer type"
              required
              options={[
                { value: 'company', label: 'Company' },
                { value: 'individual', label: 'Individual' },
              ]}
            />
            <SelectField
              form={form}
              name="payment_terms"
              label="Payment terms"
              required
              hint={prepaid ? 'Pays before trucks are dispatched.' : 'Loads delivered first, invoiced on credit.'}
              options={[
                { value: 'prepaid', label: 'Prepaid' },
                { value: 'credit', label: 'Credit' },
              ]}
            />
            <TextField
              form={form}
              name="credit_load_cap"
              label="Credit cap (loads)"
              inputMode="numeric"
              readOnly={prepaid}
              aria-readonly={prepaid}
              className={prepaid ? '[&_input]:bg-surface-2 [&_input]:text-ink-3' : undefined}
              hint={prepaid ? 'Locked at 0 for prepaid customers.' : 'Most unpaid loads allowed at once.'}
            />
            <TextField
              form={form}
              name="credit_days"
              label="Credit days"
              inputMode="numeric"
              readOnly={prepaid}
              aria-readonly={prepaid}
              className={prepaid ? '[&_input]:bg-surface-2 [&_input]:text-ink-3' : undefined}
              hint={prepaid ? 'Locked at 0 for prepaid customers.' : 'Days allowed to pay after delivery.'}
            />
            <TextareaField form={form} name="notes" label="Notes" className="md:col-span-2" />
          </FormGrid>
        </Card>
        <FormActions>
          <Button type="submit" block className="md:w-auto" loading={save.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            {customer ? 'Save customer' : 'Create customer'}
          </Button>
          <ButtonLink to={backTo} variant="secondary" block className="md:w-auto">
            Cancel
          </ButtonLink>
        </FormActions>
      </form>
    </>
  )
}
