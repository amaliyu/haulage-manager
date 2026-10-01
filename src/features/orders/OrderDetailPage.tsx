import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Ban, Banknote, CheckCircle2, PackageCheck, Send, TriangleAlert, Undo2, UserRoundCog, XCircle } from 'lucide-react'
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  ErrorState,
  Facts,
  PageHeader,
  ReasonDialog,
  Section,
  SkeletonBlock,
  useToast,
} from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { formatDateTime, formatNaira } from '@/lib/format'
import { orderTotals, overpaid, tripProgress, type OrderWithRefs } from '@/services/orders'
import { countPhotos, tripFlags, type TripWithCrew } from '@/services/trips'
import { TermsPill } from '@/features/customers/CustomerListPage'
import { materialLabel } from '@/features/sources/labels'
import { AssignTripModal, type AssignableTrip } from '@/features/dispatch/AssignTripModal'
import { useCancelOrder, useCancelTrip, useOrder, useOrderEvents, useOrderTrips, useUnassignTrip } from './api'
import { OrderStatusPill, TripStatusPill, paymentMethodLabel } from './labels'
import { RecordPaymentModal } from './RecordPaymentModal'
import { BreakdownDialog, OfficeStepDialog, PhotoThumb, TripFlagPills, officeStep } from './TripProgress'

const EVENT_LABEL: Record<string, string> = {
  created: 'Trip created',
  assigned: 'Dispatched',
  cancelled: 'Cancelled',
  loaded: 'Loaded',
  in_transit: 'In transit',
  delivered: 'Delivered',
  settled: 'Settled',
  disputed: 'Disputed',
  note: 'Update',
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const q = useOrder(id)

  if (q.isLoading) {
    return (
      <>
        <PageHeader title={<SkeletonBlock className="h-8 w-[220px]" />} back={{ to: '/orders', label: 'Orders' }} />
        <SkeletonBlock className="h-[200px] w-full" />
      </>
    )
  }
  if (q.isError || !q.data) {
    return (
      <>
        <PageHeader title="Order" back={{ to: '/orders', label: 'Orders' }} />
        <ErrorState what="Could not load this order." error={q.error} onRetry={() => void q.refetch()} />
      </>
    )
  }
  return <OrderDetail order={q.data} />
}

function OrderDetail({ order: o }: { order: OrderWithRefs }) {
  const { canDispatch, canRecordPayment } = useRole()
  const toast = useToast()
  const cancelOrder = useCancelOrder()
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const t = orderTotals(o)
  const credit = overpaid(o)
  const closed = o.status === 'completed' || o.status === 'cancelled'
  const awaiting = o.status === 'awaiting_payment'
  const paidPrepaid = o.payment_terms === 'prepaid' && Boolean(o.payment_id)
  const remaining = t.live - t.done

  return (
    <>
      <PageHeader
        title={<span className="num">{o.order_number}</span>}
        back={{ to: '/orders', label: 'Orders' }}
        meta={
          <>
            <OrderStatusPill status={o.status} />
            <TermsPill terms={o.payment_terms} />
            <span>{o.customer?.name}</span>
          </>
        }
        action={
          canDispatch &&
          !closed && (
            <Button variant="secondary" icon={<Ban size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setCancelling(true)}>
              Cancel order
            </Button>
          )
        }
      />

      {awaiting && (
        <div role="status" className="mb-4 flex flex-col gap-3 rounded-panel border border-line border-l-2 border-l-warn bg-panel p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle size={20} strokeWidth={1.5} className="mt-px shrink-0 text-warn" aria-hidden />
            <div>
              <p className="font-semibold text-ink">Awaiting payment of <span className="num">{formatNaira(t.total)}</span></p>
              <p className="text-small text-ink-2">Trips cannot be dispatched until finance records the full payment.</p>
            </div>
          </div>
          {canRecordPayment && (
            <Button block className="md:w-auto" icon={<Banknote size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setPaying(true)}>
              Record payment
            </Button>
          )}
        </div>
      )}

      <Card emphasis={!awaiting}>
        <Facts
          items={[
            { label: 'Customer', value: o.customer ? <Link to={`/customers/${o.customer.id}`} className="inline-flex min-h-touch items-center underline underline-offset-4 md:min-h-0">{o.customer.name}</Link> : '—' },
            { label: 'Delivery site', value: o.site ? `${o.site.name} · ${o.site.area}` : '—' },
            { label: 'Route', value: o.route ? <Link to={`/routes/${o.route.id}`} className="inline-flex min-h-touch items-center underline underline-offset-4 md:min-h-0">{o.route.name}</Link> : '—' },
            { label: 'Material', value: materialLabel(o.material) },
            { label: 'Price per trip', value: formatNaira(o.price_per_trip), numeric: true },
            { label: 'Trips', value: tripProgress(t), numeric: true },
            { label: 'Order total', value: <span className="font-display text-section font-bold">{formatNaira(t.total)}</span>, numeric: true },
            {
              label: 'Payment',
              value: o.payment ? (
                <>
                  {`${formatNaira(o.payment.amount)} paid · ${paymentMethodLabel(o.payment.method)}${o.payment.bank_reference ? ` · ${o.payment.bank_reference}` : ''} · ${formatDateTime(o.payment.received_at)}`}
                  {credit > 0 && (
                    <span className="mt-1 block text-small text-ink-2">
                      <span className="num font-semibold text-ink">{formatNaira(credit)}</span> more than this order now costs, because trips were
                      cancelled. Kept as customer credit until finance refunds it or uses it on another order.
                    </span>
                  )}
                </>
              ) : o.payment_id
                  ? 'Paid'
                  : o.payment_terms === 'credit'
                    ? 'On credit'
                    : 'Not paid yet',
            },
            { label: 'Placed', value: formatDateTime(o.created_at), numeric: true },
            { label: 'Notes', value: o.notes || '—' },
            ...(o.cancel_reason ? [{ label: 'Cancelled because', value: o.cancel_reason }] : []),
          ]}
        />
      </Card>

      <TripsSection order={o} />
      <PhotosSection orderId={o.id} />
      <HistorySection orderId={o.id} />

      <RecordPaymentModal open={paying} onClose={() => setPaying(false)} order={{ id: o.id, order_number: o.order_number, total: t.total }} />
      <ReasonDialog
        open={cancelling}
        title={`Cancel order ${o.order_number}?`}
        message={
          <>
            <p>
              All {remaining} remaining {remaining === 1 ? 'trip' : 'trips'} will be cancelled and their trucks freed. This cannot be undone.
            </p>
            {paidPrepaid && remaining > 0 && (
              <p className="mt-2 font-semibold text-ink">
                {o.customer?.name ?? 'The customer'} has already paid for these trips. <span className="num">{formatNaira(remaining * o.price_per_trip)}</span> will
                be left as credit until finance refunds it or uses it.
              </p>
            )}
          </>
        }
        reasonLabel="Why is it cancelled?"
        confirmLabel="Cancel order"
        loading={cancelOrder.isPending}
        onClose={() => setCancelling(false)}
        onConfirm={async (reason) => {
          try {
            await cancelOrder.mutateAsync({ id: o.id, reason })
            toast.success(`Order ${o.order_number} cancelled.`)
            setCancelling(false)
          } catch (err) {
            toast.error(err, 'Could not cancel the order.')
          }
        }}
      />
    </>
  )
}

function TripsSection({ order: o }: { order: OrderWithRefs }) {
  const { canDispatch } = useRole()
  const toast = useToast()
  const q = useOrderTrips(o.id)
  const cancelTrip = useCancelTrip()
  const unassign = useUnassignTrip()
  const [assigning, setAssigning] = useState<AssignableTrip | null>(null)
  const [cancelling, setCancelling] = useState<TripWithCrew | null>(null)
  const [unassigning, setUnassigning] = useState<TripWithCrew | null>(null)
  const [stepping, setStepping] = useState<TripWithCrew | null>(null)
  const [broken, setBroken] = useState<TripWithCrew | null>(null)
  const dispatchable = o.status === 'ready' || o.status === 'in_progress'
  const where = `${o.customer?.name ?? ''} · ${o.site ? `${o.site.name}, ${o.site.area}` : ''}`

  const actions = (tr: TripWithCrew) => {
    if (!canDispatch) return null
    const small = 'md:w-auto md:min-h-row md:h-row'
    const step = officeStep(tr.status)
    if (tr.status === 'loaded' || tr.status === 'in_transit') {
      return (
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:justify-end xl:flex-col xl:items-end">
          <Button variant="secondary" block className={small} icon={<CheckCircle2 size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setStepping(tr)}>
            Mark delivered
          </Button>
          <Button variant="ghost" block className={small} icon={<TriangleAlert size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setBroken(tr)}>
            Truck broke down
          </Button>
        </div>
      )
    }
    if (tr.status !== 'pending' && tr.status !== 'assigned') return null
    return (
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:justify-end xl:flex-col xl:items-end">
        {tr.status === 'pending' && dispatchable && (
          <Button block className={small} icon={<Send size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setAssigning({ ...tr, where })}>
            Dispatch
          </Button>
        )}
        {tr.status === 'assigned' && (
          <>
            <Button variant="secondary" block className={small} icon={<UserRoundCog size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setAssigning({ ...tr, where })}>
              Reassign
            </Button>
            <Button variant="secondary" block className={small} icon={<Undo2 size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setUnassigning(tr)}>
              Unassign
            </Button>
            {step === 'loaded' && (
              <Button variant="secondary" block className={small} icon={<PackageCheck size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setStepping(tr)}>
                Mark loaded
              </Button>
            )}
          </>
        )}
        <Button variant="ghost" block className={small} icon={<XCircle size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setCancelling(tr)}>
          Cancel trip
        </Button>
      </div>
    )
  }

  const crew = (tr: TripWithCrew) =>
    tr.driver ? (
      <span>
        {tr.driver.full_name} · <span className="num">{tr.truck?.plate_number ?? '—'}</span>
      </span>
    ) : (
      <span className="text-ink-3">Not dispatched</span>
    )

  return (
    <Section title="Trips">
      <DataTable
        noun="trips"
        caption="Trips on this order"
        rows={q.data}
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(tr) => tr.id}
        skeletonRows={Math.min(o.trips_ordered, 4)}
        emptyMessage="This order has no trips."
        columns={[
          { key: 'n', header: 'Trip', render: (tr) => <span className="num whitespace-nowrap font-semibold">{tr.trip_number}</span> },
          { key: 'crew', header: 'Driver · truck', render: crew },
          { key: 'at', header: 'Dispatched', render: (tr) => <span className="num">{tr.assigned_at ? formatDateTime(tr.assigned_at) : '—'}</span> },
          {
            key: 'status',
            header: 'Status',
            render: (tr) => (
              <span className="flex flex-col items-start gap-1">
                <TripStatusPill status={tr.status} />
                <TripFlagPills flags={flagsOf(tr)} />
                {tr.cancel_reason && <span className="text-small text-ink-3">{tr.cancel_reason}</span>}
              </span>
            ),
          },
          ...(canDispatch ? [{ key: 'actions', header: 'Actions', align: 'right' as const, render: actions }] : []),
        ]}
        mobile={{
          title: (tr) => <span className="num">{tr.trip_number}</span>,
          lines: (tr) => (
            <>
              {crew(tr)}
              {tr.assigned_at && <span className="num">Dispatched {formatDateTime(tr.assigned_at)}</span>}
              <TripFlagPills flags={flagsOf(tr)} />
              {tr.cancel_reason && <span className="text-ink-3">{tr.cancel_reason}</span>}
            </>
          ),
          figureCaption: (tr) => <TripStatusPill status={tr.status} />,
          actions: canDispatch ? actions : undefined,
        }}
      />

      <AssignTripModal trip={assigning} onClose={() => setAssigning(null)} />
      <OfficeStepDialog trip={stepping && { ...stepping, driverName: stepping.driver?.full_name }} onClose={() => setStepping(null)} />
      <BreakdownDialog
        trip={broken && { ...broken, plate: broken.truck?.plate_number }}
        onClose={() => setBroken(null)}
        onReplacement={(t) => setAssigning({ id: t.id, trip_number: t.trip_number, driver_id: null, truck_id: null, where })}
      />
      <ReasonDialog
        open={Boolean(cancelling)}
        title={`Cancel trip ${cancelling?.trip_number ?? ''}?`}
        message={
          <>
            <p>
              {cancelling?.truck
                ? `Truck ${cancelling.truck.plate_number} and ${cancelling.driver?.full_name ?? 'the driver'} are freed. This cannot be undone.`
                : 'This cannot be undone.'}
            </p>
            {o.payment_terms === 'prepaid' && o.payment_id && (
              <p className="mt-2 font-semibold text-ink">
                {o.customer?.name ?? 'The customer'} has already paid for this trip. <span className="num">{formatNaira(o.price_per_trip)}</span> will be
                left as credit until finance refunds it or uses it.
              </p>
            )}
          </>
        }
        reasonLabel="Why is it cancelled?"
        confirmLabel="Cancel trip"
        loading={cancelTrip.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={async (reason) => {
          if (!cancelling) return
          try {
            await cancelTrip.mutateAsync({ tripId: cancelling.id, reason })
            toast.success(`Trip ${cancelling.trip_number} cancelled.`)
            setCancelling(null)
          } catch (err) {
            toast.error(err, 'Could not cancel the trip.')
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(unassigning)}
        title={`Unassign trip ${unassigning?.trip_number ?? ''}?`}
        message={`${unassigning?.driver?.full_name ?? 'The driver'} and truck ${unassigning?.truck?.plate_number ?? ''} are freed and the trip goes back to To dispatch.`}
        confirmLabel="Unassign"
        loading={unassign.isPending}
        onClose={() => setUnassigning(null)}
        onConfirm={async () => {
          if (!unassigning) return
          try {
            await unassign.mutateAsync(unassigning.id)
            toast.success(`Trip ${unassigning.trip_number} is back in To dispatch.`)
            setUnassigning(null)
          } catch (err) {
            toast.error(err, 'Could not unassign the trip.')
          }
        }}
      />
    </Section>
  )
}

const flagsOf = (tr: TripWithCrew) => tripFlags({ ...tr, loadingPhotos: countPhotos(tr.photos, 'loading') })

/** Loading photos beside the truck's full-load reference, then delivery photos. */
function PhotosSection({ orderId }: { orderId: string }) {
  const q = useOrderTrips(orderId)
  const withPhotos = (q.data ?? []).filter((tr) => tr.photos?.length)
  if (!withPhotos.length) return null
  return (
    <Section title="Photos">
      <ul className="flex flex-col gap-3">
        {withPhotos.map((tr) => {
          const sorted = [...tr.photos].sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? ''))
          return (
            <li key={tr.id} className="rounded-panel border border-line bg-panel p-3">
              <p className="mb-2 font-semibold">
                <span className="num">{tr.trip_number}</span>
                {tr.truck && <span className="num font-normal text-ink-2"> · {tr.truck.plate_number}</span>}
              </p>
              <div className="flex flex-wrap gap-3">
                <PhotoThumb path={tr.truck?.reference_load_photo_url} alt={`Full load reference for ${tr.truck?.plate_number ?? 'the truck'}`} caption="Reference full load" />
                {sorted.map((ph) => (
                  <PhotoThumb
                    key={ph.id}
                    path={ph.storage_path}
                    alt={`${ph.photo_type === 'loading' ? 'Loading' : 'Delivery'} photo for ${tr.trip_number}`}
                    caption={`${ph.photo_type === 'loading' ? 'Loading' : ph.photo_type === 'delivery' ? 'Delivery' : 'Other'}${ph.taken_at ? ` · ${formatDateTime(ph.taken_at)}` : ''}`}
                  />
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function HistorySection({ orderId }: { orderId: string }) {
  const q = useOrderEvents(orderId)
  return (
    <Section title="History">
      {q.isLoading ? (
        <SkeletonBlock className="h-[120px] w-full" />
      ) : q.isError ? (
        <ErrorState what="Could not load the history." error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <p className="text-body text-ink-2">Nothing has happened on this order yet.</p>
      ) : (
        <ol className="rounded-panel border border-line bg-panel">
          {q.data.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 border-b border-line p-3 last:border-b-0 md:flex-row md:items-baseline md:gap-4">
              <span className="num w-[150px] shrink-0 text-small text-ink-3">{formatDateTime(e.occurred_at)}</span>
              <span className="min-w-0">
                <span className="font-semibold">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                <span className="num text-ink-2"> · {e.trip?.trip_number}</span>
                {e.note && <span className="text-ink-2"> · {e.note}</span>}
                {e.actor && <span className="text-ink-3"> · by {e.actor.full_name}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}
