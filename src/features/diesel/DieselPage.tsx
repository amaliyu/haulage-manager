import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Fuel, Save } from 'lucide-react'
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FormGrid,
  MetricTile,
  Modal,
  NairaField,
  PageHeader,
  Section,
  StatusPill,
  useToast,
} from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { formatDateTime, formatNaira } from '@/lib/format'
import { naira } from '@/lib/zod'
import { useDieselPrices, useSetDieselPrice } from './api'

const schema = z.object({
  price_per_litre: naira('Pump price per litre', { allowZero: false }).refine((n) => n <= 20000, 'That is more than ₦20,000 per litre. Check the figure.'),
})
type In = z.input<typeof schema>
type Out = z.output<typeof schema>

function RecordPriceModal({ open, onClose, previous }: { open: boolean; onClose: () => void; previous?: number }) {
  const toast = useToast()
  const set = useSetDieselPrice()
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(schema), defaultValues: { price_per_litre: '' } })
  useEffect(() => {
    if (open) form.reset({ price_per_litre: '' })
  }, [open, form])
  const next = Number(String(form.watch('price_per_litre')).replace(/[,\s₦]/g, ''))

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await set.mutateAsync(v.price_per_litre)
      toast.success(`Diesel price recorded: ${formatNaira(v.price_per_litre)}/L.`)
      onClose()
    } catch (err) {
      toast.error(err, 'Could not record the diesel price.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record pump price"
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" form="diesel-form" block className="md:w-auto" loading={set.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            Save price
          </Button>
          <Button variant="secondary" block className="md:w-auto" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="diesel-form" noValidate onSubmit={onSubmit}>
        <FormGrid>
          <NairaField
            form={form}
            name="price_per_litre"
            label="Pump price per litre"
            required
            hint={previous ? `Previous: ${formatNaira(previous)}/L` : 'No previous price.'}
          />
          {previous && Number.isFinite(next) && next > 0 && next !== previous && (
            <p className="num -mt-2 text-small font-semibold">
              {next > previous ? 'Up' : 'Down'} {formatNaira(Math.abs(next - previous))} per litre ({(((next - previous) / previous) * 100).toFixed(1)}%)
            </p>
          )}
          <p className="text-small text-ink-2">
            The current price closes now. Route prices do not change automatically; review them after a big move.
          </p>
        </FormGrid>
      </form>
    </Modal>
  )
}

export function DieselPage() {
  const { canWriteMasterData } = useRole()
  const q = useDieselPrices()
  const [open, setOpen] = useState(false)
  const current = q.data?.find((d) => d.effective_to === null)
  const previous = q.data?.find((d) => d.effective_to !== null)

  const recordButton = canWriteMasterData ? (
    <Button icon={<Fuel size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setOpen(true)}>
      Record price
    </Button>
  ) : undefined

  return (
    <>
      <PageHeader title="Diesel price" action={recordButton} meta={!canWriteMasterData && <span>Read only</span>} />
      {q.isError ? (
        <ErrorState what="Could not load diesel prices." error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.isLoading && !current ? (
        <EmptyState message="No pump price recorded yet." action={recordButton} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-[640px]">
          <MetricTile
            label="Current pump price"
            loading={q.isLoading}
            value={current ? `${formatNaira(current.price_per_litre)}/L` : '—'}
            context={current ? `Since ${formatDateTime(current.effective_from)}` : undefined}
          />
          <MetricTile
            label="Previous"
            loading={q.isLoading}
            value={previous ? `${formatNaira(previous.price_per_litre)}/L` : '—'}
            context={previous?.effective_to ? `Until ${formatDateTime(previous.effective_to)}` : 'No earlier price'}
          />
        </div>
      )}

      <Section title="History">
        <DataTable
          noun="diesel price history"
          caption="Diesel price history, newest first"
          rows={q.data}
          isLoading={q.isLoading}
          isError={q.isError}
          error={q.error}
          onRetry={() => void q.refetch()}
          rowKey={(d) => d.id}
          skeletonRows={4}
          emptyMessage="No history yet."
          columns={[
            { key: 'price', header: 'Price / litre', align: 'right', render: (d) => <span className="font-semibold">{formatNaira(d.price_per_litre)}</span> },
            { key: 'from', header: 'From', render: (d) => <span className="num">{formatDateTime(d.effective_from)}</span> },
            { key: 'to', header: 'To', render: (d) => (d.effective_to ? <span className="num">{formatDateTime(d.effective_to)}</span> : <StatusPill tone="ok">Current</StatusPill>) },
            { key: 'by', header: 'Set by', render: (d) => d.setter?.full_name ?? '—' },
          ]}
          mobile={{
            title: (d) => <span className="num">{formatDateTime(d.effective_from)}</span>,
            lines: (d) => (
              <>
                {d.effective_to && <span className="num">Until {formatDateTime(d.effective_to)}</span>}
                {d.setter && <span>Set by {d.setter.full_name}</span>}
              </>
            ),
            figure: (d) => formatNaira(d.price_per_litre),
            figureCaption: (d) => (d.effective_to ? <StatusPill tone="neutral">Closed</StatusPill> : <StatusPill tone="ok">Current</StatusPill>),
          }}
        />
      </Section>
      <RecordPriceModal open={open} onClose={() => setOpen(false)} previous={current?.price_per_litre} />
    </>
  )
}
