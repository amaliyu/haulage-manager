import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Send, TriangleAlert } from 'lucide-react'
import { Button, ButtonLink, DataTable, EmptyState, ErrorState, PageHeader, Section, SkeletonBlock } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import { ACTIVE_TRIP_STATUSES, countPhotos, tripFlags, type DispatchTrip, type TripStatus } from '@/services/trips'
import { useDispatchTrips } from '@/features/orders/api'
import { TripStatusPill } from '@/features/orders/labels'
import { materialLabel } from '@/features/sources/labels'
import { BreakdownDialog, TripFlagPills } from '@/features/orders/TripProgress'
import { AssignTripModal, type AssignableTrip } from './AssignTripModal'

/** "2h 15m" since a timestamp. */
function since(iso: string | null) {
  if (!iso) return '—'
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  return h < 48 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`
}

const flagsOf = (t: DispatchTrip) => tripFlags({ ...t, loadingPhotos: countPhotos(t.photos, 'loading') })
const moving = (t: DispatchTrip) => t.status === 'loaded' || t.status === 'in_transit'

const where = (t: DispatchTrip) => `${t.order.customer?.name ?? '—'} · ${t.order.site ? `${t.order.site.name}, ${t.order.site.area}` : '—'}`

export function DispatchPage() {
  const q = useDispatchTrips()
  const [assigning, setAssigning] = useState<AssignableTrip | null>(null)
  const [broken, setBroken] = useState<DispatchTrip | null>(null)

  const groups = useMemo(() => {
    const rows = q.data ?? []
    const byOrderAge = (a: DispatchTrip, b: DispatchTrip) =>
      a.order.created_at.localeCompare(b.order.created_at) || a.trip_number.localeCompare(b.trip_number)
    return {
      toDispatch: rows.filter((t) => t.status === 'pending' && (t.order.status === 'ready' || t.order.status === 'in_progress')).sort(byOrderAge),
      onRoad: rows.filter((t) => ACTIVE_TRIP_STATUSES.includes(t.status as TripStatus)).sort((a, b) => (a.assigned_at ?? '').localeCompare(b.assigned_at ?? '')),
      waiting: rows.filter((t) => t.status === 'pending' && t.order.status === 'awaiting_payment'),
    }
  }, [q.data])

  // Unpaid orders grouped by order, not listed trip by trip.
  const waitingOrders = useMemo(() => {
    const m = new Map<string, { id: string; number: string; where: string; trips: number }>()
    for (const t of groups.waiting) {
      const cur = m.get(t.order.id) ?? { id: t.order.id, number: t.order.order_number, where: where(t), trips: 0 }
      cur.trips += 1
      m.set(t.order.id, cur)
    }
    return [...m.values()]
  }, [groups.waiting])

  const common = {
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    onRetry: () => void q.refetch(),
    rowKey: (t: DispatchTrip) => t.id,
  }

  return (
    <>
      <PageHeader
        title="Dispatch"
        meta={q.data && <span className="num">{groups.toDispatch.length} to dispatch · {groups.onRoad.length} on the road</span>}
        action={<ButtonLink to="/orders/new" variant="secondary">New order</ButtonLink>}
      />

      <section>
        <h2 className="mb-3 text-section">To dispatch</h2>
        <DataTable
          {...common}
          noun="trips to dispatch"
          caption="Trips to dispatch"
          rows={q.data ? groups.toDispatch : undefined}
          skeletonRows={3}
          emptyMessage="Nothing waiting. Every paid trip is on the road."
          columns={[
            { key: 'n', header: 'Trip', render: (t) => <span className="num whitespace-nowrap font-semibold">{t.trip_number}</span> },
            { key: 'o', header: 'Order', render: (t) => <Link to={`/orders/${t.order.id}`} className="num whitespace-nowrap underline underline-offset-4">{t.order.order_number}</Link> },
            { key: 'w', header: 'Customer · site', render: where },
            { key: 'r', header: 'Route', render: (t) => `${t.order.route?.name ?? '—'} · ${materialLabel(t.order.material)}` },
            {
              key: 'a',
              header: 'Action',
              align: 'right',
              render: (t) => (
                <Button className="md:min-h-row md:h-row" icon={<Send size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setAssigning({ ...t, where: where(t) })}>
                  Dispatch
                </Button>
              ),
            },
          ]}
          mobile={{
            title: (t) => <span className="num">{t.trip_number} · {t.order.order_number}</span>,
            lines: (t) => (
              <>
                <span>{where(t)}</span>
                <span>{t.order.route?.name ?? '—'} · {materialLabel(t.order.material)}</span>
              </>
            ),
            actions: (t) => (
              <Button block icon={<Send size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setAssigning({ ...t, where: where(t) })}>
                Dispatch {t.trip_number}
              </Button>
            ),
          }}
        />
      </section>

      <Section title="On the road">
        <DataTable
          {...common}
          noun="trips on the road"
          caption="Trips on the road"
          rows={q.data ? groups.onRoad : undefined}
          rowHref={(t) => `/orders/${t.order.id}`}
          skeletonRows={3}
          emptyMessage="No trucks on the road right now."
          columns={[
            { key: 'n', header: 'Trip', render: (t) => <span className="num whitespace-nowrap font-semibold">{t.trip_number}</span> },
            { key: 'c', header: 'Driver · truck', render: (t) => <span>{t.driver?.full_name ?? '—'} · <span className="num">{t.truck?.plate_number ?? '—'}</span></span> },
            { key: 'w', header: 'Customer · site', render: where },
            { key: 's', header: 'Out for', align: 'right', render: (t) => <span className="num">{since(t.assigned_at)}</span> },
            {
              key: 'st',
              header: 'Status',
              render: (t) => (
                <span className="flex flex-col items-start gap-1">
                  <TripStatusPill status={t.status} />
                  <TripFlagPills flags={flagsOf(t)} />
                </span>
              ),
            },
            {
              key: 'a',
              header: 'Action',
              align: 'right',
              render: (t) =>
                moving(t) && (
                  <Button variant="ghost" className="md:min-h-row md:h-row" icon={<TriangleAlert size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setBroken(t)}>
                    Broke down
                  </Button>
                ),
            },
          ]}
          mobile={{
            title: (t) => <span className="num">{t.truck?.plate_number ?? '—'}</span>,
            lines: (t) => (
              <>
                <span className="font-semibold text-ink">{t.driver?.full_name ?? '—'}</span>
                <span className="num">{t.trip_number} · dispatched {formatDateTime(t.assigned_at)}</span>
                <span>{where(t)}</span>
                <TripFlagPills flags={flagsOf(t)} />
              </>
            ),
            figure: (t) => since(t.assigned_at),
            figureCaption: (t) => <TripStatusPill status={t.status} />,
            actions: (t) =>
              moving(t) && (
                <Button variant="secondary" block icon={<TriangleAlert size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setBroken(t)}>
                  Truck broke down
                </Button>
              ),
          }}
        />
      </Section>

      <Section title="Waiting for payment">
        {q.isLoading ? (
          <SkeletonBlock className="h-[72px] w-full" />
        ) : q.isError ? (
          <ErrorState what="Could not load orders waiting for payment." error={q.error} onRetry={() => void q.refetch()} />
        ) : waitingOrders.length === 0 ? (
          <EmptyState message="No prepaid orders waiting for payment." />
        ) : (
          <ul className="flex flex-col gap-2">
            {waitingOrders.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="flex min-h-[72px] items-center gap-3 rounded-panel border border-line bg-surface-2 p-3 text-ink-2 no-underline">
                  <Clock size={20} strokeWidth={1.5} className="shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="num font-semibold text-ink">{o.number}</span> · {o.where}
                    <span className="num block text-small">{o.trips} {o.trips === 1 ? 'trip' : 'trips'} locked until paid</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <AssignTripModal trip={assigning} onClose={() => setAssigning(null)} />
      <BreakdownDialog
        trip={broken && { ...broken, plate: broken.truck?.plate_number }}
        onClose={() => setBroken(null)}
        onReplacement={(r) => broken && setAssigning({ id: r.id, trip_number: r.trip_number, driver_id: null, truck_id: null, where: where(broken) })}
      />
    </>
  )
}
