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
  useToast,
} from '@/components/ui'
import { decimal, optionalText } from '@/lib/zod'
import { OWNER_TYPES, TRUCK_STATUSES, type Truck } from '@/services/trucks'
import { useSaveTruck, useTruck } from './api'
import { OWNER_LABEL, STATUS_LABEL } from './labels'

const schema = z
  .object({
    plate_number: z
      .string()
      .trim()
      .min(1, 'Plate number is required')
      .max(20, 'Plate number is too long')
      .transform((v) => v.toUpperCase().replace(/\s+/g, '-'))
      .refine((v) => /^[A-Z0-9-]{5,20}$/.test(v), 'Use letters, numbers and dashes, e.g. ABJ-123-XY'),
    make: optionalText(60),
    model: optionalText(60),
    capacity_tons: decimal('Capacity', { required: false, min: 1, max: 100 }),
    owner_type: z.enum(OWNER_TYPES as [string, ...string[]], { message: 'Choose who owns the truck' }),
    owner_name: optionalText(120),
    status: z.enum(TRUCK_STATUSES as [string, ...string[]], { message: 'Choose a status' }),
  })
  .superRefine((v, ctx) => {
    if (v.owner_type === 'partner' && !v.owner_name) {
      ctx.addIssue({ code: 'custom', path: ['owner_name'], message: 'Name the partner who owns this truck' })
    }
  })
type In = z.input<typeof schema>
type Out = z.output<typeof schema>

export function TruckFormPage() {
  const { id } = useParams()
  const q = useTruck(id)
  if (id && q.isLoading) {
    return (
      <>
        <PageHeader title="Edit truck" back={{ to: `/trucks/${id}`, label: 'Truck' }} />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonBlock key={i} className="h-input w-full" />
          ))}
        </div>
      </>
    )
  }
  if (id && (q.isError || !q.data)) return <ErrorState what="Could not load this truck." error={q.error} onRetry={() => void q.refetch()} />
  return <TruckForm truck={q.data} />
}

function TruckForm({ truck }: { truck?: Truck }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveTruck()
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues: {
      plate_number: truck?.plate_number ?? '',
      make: truck?.make ?? '',
      model: truck?.model ?? '',
      capacity_tons: truck?.capacity_tons != null ? String(truck.capacity_tons) : '',
      owner_type: truck?.owner_type ?? 'spv',
      owner_name: truck?.owner_name ?? '',
      status: truck?.status ?? 'available',
    },
  })

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const row = await save.mutateAsync({ id: truck?.id, input: { ...v, is_active: v.status !== 'inactive' } })
      toast.success(truck ? 'Truck saved.' : `Truck ${row.plate_number} added. Add its reference photo next.`)
      navigate(`/trucks/${row.id}`, { replace: true })
    } catch (err) {
      toast.error(err, 'Could not save the truck.')
    }
  })

  const backTo = truck ? `/trucks/${truck.id}` : '/trucks'
  return (
    <>
      <PageHeader title={truck ? `Edit ${truck.plate_number}` : 'New truck'} back={{ to: backTo, label: truck ? 'Truck' : 'Trucks' }} />
      <form noValidate onSubmit={onSubmit} className="max-w-[720px]">
        <Card>
          <FormGrid cols={2}>
            <TextField form={form} name="plate_number" label="Plate number" required autoCapitalize="characters" autoComplete="off" />
            <TextField form={form} name="capacity_tons" label="Capacity (tonnes)" inputMode="decimal" />
            <TextField form={form} name="make" label="Make" hint="e.g. Sinotruk, MAN, Mack" />
            <TextField form={form} name="model" label="Model" />
            <SelectField
              form={form}
              name="owner_type"
              label="Owner type"
              required
              hint="SPV, the operating partner, or a third-party partner."
              options={OWNER_TYPES.map((o) => ({ value: o, label: OWNER_LABEL[o] }))}
            />
            <TextField form={form} name="owner_name" label="Owner name" />
            <SelectField
              form={form}
              name="status"
              label="Status"
              required
              options={TRUCK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </FormGrid>
        </Card>
        <FormActions>
          <Button type="submit" block className="md:w-auto" loading={save.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            {truck ? 'Save truck' : 'Add truck'}
          </Button>
          <ButtonLink to={backTo} variant="secondary" block className="md:w-auto">
            Cancel
          </ButtonLink>
        </FormActions>
      </form>
    </>
  )
}
