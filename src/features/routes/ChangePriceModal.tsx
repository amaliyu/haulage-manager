import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save } from 'lucide-react'
import { Button, FormGrid, Modal, NairaField, TextareaField, useToast } from '@/components/ui'
import { formatNaira } from '@/lib/format'
import { naira, optionalText } from '@/lib/zod'
import type { RouteWithCurrent } from '@/services/routes'
import { useDieselPrices } from '@/features/diesel/api'
import { useChangeRoutePrice } from './api'
import { tripEconomics } from './economics'

export const priceSchema = z.object({
  customer_price: naira('Customer price', { allowZero: false }),
  material_cost: naira('Material cost'),
  crew_cost: naira('Crew cost'),
  diesel_price_per_litre: naira('Diesel price per litre', { allowZero: false }),
  note: optionalText(300),
})
export type PriceIn = z.input<typeof priceSchema>
export type PriceOut = z.output<typeof priceSchema>

function Previous({ label, value, next }: { label: string; value: number | undefined; next: string }) {
  if (value === undefined) return null
  const n = Number(String(next).replace(/[,\s₦]/g, ''))
  const delta = Number.isFinite(n) && String(next).trim() !== '' ? n - value : 0
  return (
    <p className="num -mt-2 flex flex-wrap gap-x-2 text-small text-ink-3">
      <span>
        {label}: {formatNaira(value)}
      </span>
      {delta !== 0 && (
        <span className="font-semibold text-ink">
          ({delta > 0 ? '+' : ''}
          {formatNaira(delta)})
        </span>
      )}
    </p>
  )
}

export function ChangePriceModal({ open, onClose, route }: { open: boolean; onClose: () => void; route: RouteWithCurrent }) {
  const toast = useToast()
  const change = useChangeRoutePrice()
  const diesel = useDieselPrices()
  const current = route.current_price
  const pump = diesel.data?.find((d) => d.effective_to === null)?.price_per_litre

  const defaults = (): PriceIn => ({
    customer_price: current ? String(current.customer_price) : '',
    material_cost: current ? String(current.material_cost) : '',
    crew_cost: String(current?.crew_cost ?? 15000),
    diesel_price_per_litre: pump ? String(pump) : current ? String(current.diesel_price_per_litre) : '',
    note: '',
  })
  const form = useForm<PriceIn, unknown, PriceOut>({ resolver: zodResolver(priceSchema), defaultValues: defaults() })

  useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current?.id, pump])

  const w = form.watch()
  const parsed = priceSchema.safeParse(w)
  const preview = parsed.success ? tripEconomics(parsed.data, Number(route.diesel_allowance_litres)) : null

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await change.mutateAsync({ route_id: route.id, ...v })
      toast.success(`New price for ${route.name}: ${formatNaira(v.customer_price)}.`)
      onClose()
    } catch (err) {
      toast.error(err, 'Could not change the price.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change price: ${route.name}`}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" form="price-form" block className="md:w-auto" loading={change.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            Save new price
          </Button>
          <Button variant="secondary" block className="md:w-auto" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="price-form" noValidate onSubmit={onSubmit}>
        <p className="mb-4 text-small text-ink-2">
          The current price closes now and the new one starts immediately. Past trips keep the price they were booked at.
        </p>
        <FormGrid>
          <NairaField form={form} name="customer_price" label="Customer price per trip" required />
          <Previous label="Previous" value={current?.customer_price} next={w.customer_price as string} />
          <NairaField form={form} name="material_cost" label="Material cost per trip" required />
          <Previous label="Previous" value={current?.material_cost} next={w.material_cost as string} />
          <NairaField form={form} name="crew_cost" label="Crew cost per trip" required />
          <Previous label="Previous" value={current?.crew_cost} next={w.crew_cost as string} />
          <NairaField
            form={form}
            name="diesel_price_per_litre"
            label="Diesel price per litre (set against)"
            required
            hint={pump ? `Current pump price is ${formatNaira(pump)}/L.` : 'No pump price recorded yet.'}
          />
          <Previous label="Previous" value={current?.diesel_price_per_litre} next={w.diesel_price_per_litre as string} />
          <TextareaField form={form} name="note" label="Reason for change" rows={2} />
        </FormGrid>
        {preview && (
          <dl className="num mt-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded border border-line bg-surface-2 p-3 text-small">
            <dt className="text-ink-2">Diesel ({Number(route.diesel_allowance_litres)} L)</dt>
            <dd className="text-right">{formatNaira(preview.diesel)}</dd>
            <dt className="text-ink-2">Total cost per trip</dt>
            <dd className="text-right">{formatNaira(preview.costs)}</dd>
            <dt className="font-semibold">Margin per trip</dt>
            <dd className={preview.margin < 0 ? 'text-right font-semibold text-danger' : 'text-right font-semibold'}>
              {formatNaira(preview.margin)}
              {preview.margin < 0 && ' (loss)'}
            </dd>
          </dl>
        )}
      </form>
    </Modal>
  )
}
