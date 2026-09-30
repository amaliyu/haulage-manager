import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { AlertTriangle, Save } from 'lucide-react'
import {
  Button,
  ButtonLink,
  Card,
  FormActions,
  FormGrid,
  PageHeader,
  SelectField,
  TextareaField,
  TextField,
  useToast,
} from '@/components/ui'
import { formatNaira, formatNumber } from '@/lib/format'
import { optionalText, wholeNumber } from '@/lib/zod'
import { listSitesForCustomer } from '@/services/customerSites'
import { useCustomers } from '@/features/customers/api'
import { useRoutes } from '@/features/routes/api'
import { materialLabel } from '@/features/sources/labels'
import { useCreateOrder, useOpenLoads } from './api'

const schema = z.object({
  customer_id: z.string().uuid('Choose a customer'),
  site_id: z.string().uuid('Choose a delivery site'),
  route_id: z.string().uuid('Choose a route'),
  trips: wholeNumber('Number of trips', { min: 1, max: 100 }),
  notes: optionalText(500),
})
type In = z.input<typeof schema>
type Out = z.output<typeof schema>

export function OrderFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const create = useCreateOrder()
  const customers = useCustomers({ search: '', type: 'all', terms: 'all', active: 'active' })
  const routes = useRoutes({ active: 'active' })

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues: { customer_id: '', site_id: '', route_id: '', trips: '1', notes: '' },
  })
  const customerId = form.watch('customer_id')
  const siteId = form.watch('site_id')
  const routeId = form.watch('route_id')
  const tripsRaw = form.watch('trips')

  const sites = useQuery({
    queryKey: ['customers', 'sites', customerId],
    queryFn: () => listSitesForCustomer(customerId),
    enabled: Boolean(customerId),
  })
  const activeSites = (sites.data ?? []).filter((s) => s.is_active)
  const customer = customers.data?.find((c) => c.id === customerId)
  const site = activeSites.find((s) => s.id === siteId)
  const route = routes.data?.find((r) => r.id === routeId)
  const credit = customer?.payment_terms === 'credit'
  const openLoads = useOpenLoads(customerId || undefined, credit)

  // A new customer means a new site list; clear a site that no longer fits.
  useEffect(() => {
    if (siteId && sites.data && !activeSites.some((s) => s.id === siteId)) form.setValue('site_id', '')
    if (!siteId && activeSites.length === 1) form.setValue('site_id', activeSites[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, sites.data])

  // Routes that go to the site's area first, then the rest.
  const routeOptions = useMemo(() => {
    const priced = (routes.data ?? []).filter((r) => r.current_price)
    const area = site?.area.trim().toLowerCase()
    const match = (r: (typeof priced)[number]) => Boolean(area) && r.destination_area.trim().toLowerCase() === area
    return [...priced.filter(match), ...priced.filter((r) => !match(r))].map((r) => ({
      value: r.id,
      label: `${r.name} · ${formatNaira(r.current_price!.customer_price)}${match(r) ? ' · matches site' : ''}`,
    }))
  }, [routes.data, site?.area])

  const trips = Number(String(tripsRaw).replace(/[,\s]/g, ''))
  const tripsOk = Number.isInteger(trips) && trips >= 1 && trips <= 100
  const price = route?.current_price?.customer_price

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const o = await create.mutateAsync({ customerId: v.customer_id, siteId: v.site_id, routeId: v.route_id, trips: v.trips, notes: v.notes })
      toast.success(`Order ${o.order_number} created with ${v.trips} ${v.trips === 1 ? 'trip' : 'trips'}.`)
      navigate(`/orders/${o.id}`, { replace: true })
    } catch (err) {
      toast.error(err, 'Could not create the order.')
    }
  })

  return (
    <>
      <PageHeader title="New order" back={{ to: '/orders', label: 'Orders' }} />
      <form noValidate onSubmit={onSubmit} className="flex max-w-[720px] flex-col gap-4">
        <Card title="Order">
          <FormGrid>
            <SelectField
              form={form}
              name="customer_id"
              label="Customer"
              required
              placeholder={customers.isLoading ? 'Loading customers…' : 'Choose a customer'}
              options={(customers.data ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.payment_terms === 'credit' ? 'Credit' : 'Prepaid'}` }))}
              hint={customers.isError ? 'Could not load customers. Reload the page.' : undefined}
            />
            <SelectField
              form={form}
              name="site_id"
              label="Delivery site"
              required
              disabled={!customerId}
              placeholder={!customerId ? 'Choose a customer first' : sites.isLoading ? 'Loading sites…' : 'Choose a site'}
              options={activeSites.map((s) => ({ value: s.id, label: `${s.name} · ${s.area}` }))}
              hint={customerId && sites.data && activeSites.length === 0 ? 'This customer has no active delivery sites. Add one on the customer screen.' : undefined}
            />
            <SelectField
              form={form}
              name="route_id"
              label="Route"
              required
              placeholder={routes.isLoading ? 'Loading routes…' : 'Choose a route'}
              options={routeOptions}
              hint="Only routes with a current price are listed. The order keeps today's price even if it changes later."
            />
            <TextField form={form} name="trips" label="Number of trips" inputMode="numeric" required hint="One trip is one full tipper load." />
            <TextareaField form={form} name="notes" label="Notes" rows={2} />
          </FormGrid>
        </Card>

        <Card title="Summary" emphasis>
          <dl className="num grid grid-cols-2 gap-x-4 gap-y-2 text-body">
            <dt className="text-ink-2">Material</dt>
            <dd className="text-right">{route?.source ? materialLabel(route.source.material) : '—'}</dd>
            <dt className="text-ink-2">Price per trip</dt>
            <dd className="text-right">{price ? formatNaira(price) : '—'}</dd>
            <dt className="text-ink-2">Trips</dt>
            <dd className="text-right">{tripsOk ? formatNumber(trips) : '—'}</dd>
            <dt className="font-semibold">Order total</dt>
            <dd className="text-right font-display text-section font-bold">{price && tripsOk ? formatNaira(price * trips) : '—'}</dd>
            <dt className="text-ink-2">Payment terms</dt>
            <dd className="text-right">{customer ? (credit ? 'Credit' : 'Prepaid') : '—'}</dd>
            {credit && (
              <>
                <dt className="text-ink-2">Open loads / credit cap</dt>
                <dd className="text-right">
                  {openLoads.isLoading ? '…' : `${formatNumber(openLoads.data ?? 0)} of ${formatNumber(customer!.credit_load_cap)}`}
                </dd>
              </>
            )}
          </dl>
          {customer && <TermsNote credit={credit} cap={customer.credit_load_cap} open={openLoads.data} trips={tripsOk ? trips : 0} />}
        </Card>

        <FormActions>
          <Button type="submit" block className="md:w-auto" loading={create.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            Create order
          </Button>
          <ButtonLink to="/orders" variant="secondary" block className="md:w-auto">
            Cancel
          </ButtonLink>
        </FormActions>
      </form>
    </>
  )
}

function TermsNote({ credit, cap, open, trips }: { credit: boolean; cap: number; open: number | undefined; trips: number }) {
  let text: string
  if (!credit) text = 'Prepaid: trips can be dispatched only after finance records the full payment.'
  else if (cap === 0) text = 'This credit customer has no credit cap set, so no trip can be dispatched. Set a cap on the customer first.'
  else if (open !== undefined && open + trips > cap)
    text = `Only ${Math.max(cap - open, 0)} more ${cap - open === 1 ? 'load' : 'loads'} can be dispatched before the credit cap is reached.`
  else return null
  return (
    <p className="mt-4 flex items-start gap-2 rounded border border-line border-l-2 border-l-warn bg-surface-2 p-3 text-small text-ink">
      <AlertTriangle size={16} strokeWidth={1.5} className="mt-px shrink-0 text-warn" aria-hidden />
      <span>{text}</span>
    </p>
  )
}
