import { useEffect, useMemo } from 'react'
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
  NairaField,
  PageHeader,
  SelectField,
  SkeletonBlock,
  TextField,
  useToast,
} from '@/components/ui'
import { formatNaira } from '@/lib/format'
import { decimal, naira, requiredText } from '@/lib/zod'
import type { RouteWithCurrent } from '@/services/routes'
import { useSources } from '@/features/sources/api'
import { useDieselPrices } from '@/features/diesel/api'
import { useRoute, useSaveRoute } from './api'

const base = {
  name: requiredText('Route name', 160),
  source_id: z.string().uuid('Choose a material source'),
  destination_area: requiredText('Destination area', 120),
  distance_km: decimal('Distance', { required: false, max: 9999.99 }),
  diesel_allowance_litres: decimal('Diesel allowance', { min: 1, max: 9999.99 }),
}
const editSchema = z.object(base)
const newSchema = z.object({
  ...base,
  customer_price: naira('Customer price', { allowZero: false }),
  material_cost: naira('Material cost'),
  crew_cost: naira('Crew cost'),
  diesel_price_per_litre: naira('Diesel price per litre', { allowZero: false }),
})
type NewIn = z.input<typeof newSchema>
type NewOut = z.output<typeof newSchema>

export function RouteFormPage() {
  const { id } = useParams()
  const q = useRoute(id)
  if (id && q.isLoading) {
    return (
      <>
        <PageHeader title="Edit route" back={{ to: `/routes/${id}`, label: 'Route' }} />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonBlock key={i} className="h-input w-full" />
          ))}
        </div>
      </>
    )
  }
  if (id && (q.isError || !q.data)) return <ErrorState what="Could not load this route." error={q.error} onRetry={() => void q.refetch()} />
  return <RouteForm route={q.data} />
}

function RouteForm({ route }: { route?: RouteWithCurrent }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveRoute()
  const sources = useSources({ active: 'active' })
  const diesel = useDieselPrices()
  const pump = diesel.data?.find((d) => d.effective_to === null)?.price_per_litre
  const isNew = !route

  const form = useForm<NewIn, unknown, NewOut>({
    // Editing a route never touches its price; prices change via "Change price".
    resolver: zodResolver(isNew ? newSchema : (editSchema as unknown as typeof newSchema)),
    defaultValues: {
      name: route?.name ?? '',
      source_id: route?.source_id ?? '',
      destination_area: route?.destination_area ?? '',
      distance_km: route?.distance_km != null ? String(route.distance_km) : '',
      diesel_allowance_litres: route ? String(route.diesel_allowance_litres) : '',
      customer_price: '',
      material_cost: '',
      crew_cost: '15000',
      diesel_price_per_litre: '',
    },
  })

  const sourceId = form.watch('source_id')
  const dest = form.watch('destination_area')
  const sourceOptions = useMemo(() => {
    const list = sources.data ?? []
    // Keep an inactive current source selectable when editing.
    if (route?.source && !list.some((s) => s.id === route.source_id)) {
      return [...list.map((s) => ({ value: s.id, label: s.name })), { value: route.source_id, label: `${route.source.name} (inactive)` }]
    }
    return list.map((s) => ({ value: s.id, label: s.name }))
  }, [sources.data, route])

  // Suggest a name and default material cost from the chosen source.
  useEffect(() => {
    if (!isNew) return
    const src = sources.data?.find((s) => s.id === sourceId)
    if (!src) return
    if (!form.getFieldState('name').isDirty) {
      const area = src.area ?? src.name.replace(/ sand site$/i, '')
      form.setValue('name', dest ? `${area} → ${dest}` : '', { shouldDirty: false })
    }
    if (!form.getFieldState('material_cost').isDirty && src.default_material_cost > 0) {
      form.setValue('material_cost', String(src.default_material_cost))
    }
  }, [isNew, sourceId, dest, sources.data, form])

  useEffect(() => {
    if (isNew && pump && !form.getValues('diesel_price_per_litre')) form.setValue('diesel_price_per_litre', String(pump))
  }, [isNew, pump, form])

  const onSubmit = form.handleSubmit(async (v) => {
    const input = {
      name: v.name,
      source_id: v.source_id,
      destination_area: v.destination_area,
      distance_km: v.distance_km,
      diesel_allowance_litres: v.diesel_allowance_litres as number,
    }
    try {
      const { route: saved, priceError } = await save.mutateAsync({
        id: route?.id,
        input,
        initialPrice: isNew
          ? {
              customer_price: v.customer_price,
              material_cost: v.material_cost,
              crew_cost: v.crew_cost,
              diesel_price_per_litre: v.diesel_price_per_litre,
              note: 'Initial price',
            }
          : undefined,
      })
      if (priceError) toast.error(priceError, 'Route saved, but the price was not. Set it from the route screen.')
      else toast.success(isNew ? `Route ${saved.name} created at ${formatNaira(v.customer_price)} per trip.` : 'Route saved.')
      navigate(`/routes/${saved.id}`, { replace: true })
    } catch (err) {
      toast.error(err, 'Could not save the route.')
    }
  })

  const backTo = route ? `/routes/${route.id}` : '/routes'

  return (
    <>
      <PageHeader title={route ? `Edit ${route.name}` : 'New route'} back={{ to: backTo, label: route ? 'Route' : 'Routes' }} />
      <form noValidate onSubmit={onSubmit} className="flex max-w-[720px] flex-col gap-4">
        <Card title="Route">
          <FormGrid cols={2}>
            <SelectField
              form={form}
              name="source_id"
              label="Material source"
              required
              placeholder={sources.isLoading ? 'Loading sources…' : 'Choose a source'}
              options={sourceOptions}
              hint={sources.isError ? 'Could not load sources. Reload the page.' : undefined}
            />
            <TextField form={form} name="destination_area" label="Destination area" required hint="e.g. Gwarinpa" />
            <TextField form={form} name="name" label="Route name" required className="md:col-span-2" />
            <TextField form={form} name="diesel_allowance_litres" label="Diesel allowance (litres)" inputMode="decimal" required hint="Litres issued per round trip" />
            <TextField form={form} name="distance_km" label="Distance (km)" inputMode="decimal" />
          </FormGrid>
        </Card>
        {isNew && (
          <Card title="Starting price">
            <FormGrid cols={2}>
              <NairaField form={form} name="customer_price" label="Customer price per trip" required />
              <NairaField form={form} name="material_cost" label="Material cost per trip" required />
              <NairaField form={form} name="crew_cost" label="Crew cost per trip" required />
              <NairaField
                form={form}
                name="diesel_price_per_litre"
                label="Diesel price per litre (set against)"
                required
                hint={pump ? `Current pump price ${formatNaira(pump)}/L` : 'No pump price recorded yet'}
              />
            </FormGrid>
          </Card>
        )}
        <FormActions>
          <Button type="submit" block className="md:w-auto" loading={save.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            {isNew ? 'Create route' : 'Save route'}
          </Button>
          <ButtonLink to={backTo} variant="secondary" block className="md:w-auto">
            Cancel
          </ButtonLink>
        </FormActions>
      </form>
    </>
  )
}
