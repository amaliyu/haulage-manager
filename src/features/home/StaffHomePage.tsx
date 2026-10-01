import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorState, MetricTile, PageHeader, Section } from '@/components/ui'
import { useProfile } from '@/hooks/useAuth'
import { ROLE_LABEL } from '@/hooks/useRole'
import { formatDateTime, formatNaira } from '@/lib/format'
import { useCustomers } from '@/features/customers/api'
import { useRoutes } from '@/features/routes/api'
import { useTrucks } from '@/features/trucks/api'
import { useDrivers } from '@/features/drivers/api'
import { useDieselPrices } from '@/features/diesel/api'
import { useDispatchTrips } from '@/features/orders/api'
import { ACTIVE_TRIP_STATUSES, type TripStatus } from '@/services/trips'

export function StaffHomePage() {
  const profile = useProfile()
  const customers = useCustomers({ search: '', type: 'all', terms: 'all', active: 'active' })
  const routes = useRoutes({ active: 'active' })
  const trucks = useTrucks({ active: 'active' })
  const drivers = useDrivers({ active: 'active' })
  const diesel = useDieselPrices()
  const board = useDispatchTrips()

  const pump = diesel.data?.find((d) => d.effective_to === null)
  const unpriced = routes.data?.filter((r) => !r.current_price) ?? []
  const available = trucks.data?.filter((t) => t.status === 'available').length ?? 0
  const noPhoto = trucks.data?.filter((t) => !t.reference_load_photo_url).length ?? 0
  const unassigned = drivers.data?.filter((d) => !d.assigned_truck_id).length ?? 0
  const credit = customers.data?.filter((c) => c.payment_terms === 'credit').length ?? 0
  const failed = [customers, routes, trucks, drivers, diesel, board].filter((x) => x.isError)
  const b = board.data ?? []
  const toDispatch = b.filter((t) => t.status === 'pending' && (t.order.status === 'ready' || t.order.status === 'in_progress')).length
  const onRoad = b.filter((t) => ACTIVE_TRIP_STATUSES.includes(t.status as TripStatus)).length
  const unpaidOrders = new Set(b.filter((t) => t.order.status === 'awaiting_payment').map((t) => t.order.id)).size
  const dispatchLink = profile.role === 'finance' ? '/orders' : '/dispatch'

  return (
    <>
      <PageHeader title="Overview" meta={<span>{profile.full_name} · {ROLE_LABEL[profile.role]}</span>} />
      {failed.length > 0 && (
        <div className="mb-4">
          <ErrorState what="Some figures could not load." error={failed[0].error} onRetry={() => failed.forEach((f) => void f.refetch())} />
        </div>
      )}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="To dispatch"
          to={dispatchLink}
          loading={board.isLoading}
          emphasis={toDispatch > 0}
          value={board.data ? toDispatch : '—'}
          context={toDispatch ? 'Paid trips waiting for a truck' : 'Nothing waiting'}
        />
        <MetricTile
          label="On the road"
          to={dispatchLink}
          loading={board.isLoading}
          value={board.data ? onRoad : '—'}
          context={onRoad === 1 ? 'Truck out now' : 'Trucks out now'}
        />
        <MetricTile
          label="Awaiting payment"
          to="/orders"
          loading={board.isLoading}
          value={board.data ? unpaidOrders : '—'}
          context={unpaidOrders ? 'Prepaid orders locked until paid' : 'No unpaid orders'}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Diesel pump price"
          to="/diesel"
          loading={diesel.isLoading}
          value={pump ? formatNaira(pump.price_per_litre) : '—'}
          context={pump ? `Per litre since ${formatDateTime(pump.effective_from)}` : 'Not recorded'}
        />
        <MetricTile
          label="Active routes"
          to="/routes"
          loading={routes.isLoading}
          value={routes.data?.length ?? '—'}
          context={routes.data?.length === 0 ? 'No routes yet' : unpriced.length ? `${unpriced.length} without a price` : 'All priced'}
        />
        <MetricTile
          label="Trucks available"
          to="/trucks"
          loading={trucks.isLoading}
          value={trucks.data ? `${available} of ${trucks.data.length}` : '—'}
          context={trucks.data?.length === 0 ? 'No trucks yet' : noPhoto ? `${noPhoto} missing a reference photo` : 'All have reference photos'}
        />
        <MetricTile
          label="Active customers"
          to="/customers"
          loading={customers.isLoading}
          value={customers.data?.length ?? '—'}
          context={`${credit} on credit`}
        />
        <MetricTile
          label="Active drivers"
          to="/drivers"
          loading={drivers.isLoading}
          value={drivers.data?.length ?? '—'}
          context={drivers.data?.length === 0 ? 'No drivers yet' : unassigned ? `${unassigned} without a truck` : 'All have a truck'}
        />
      </div>

      {unpriced.length > 0 && (
        <Section title="Needs attention">
          <ul className="flex flex-col gap-2">
            {unpriced.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/routes/${r.id}`}
                  className="flex min-h-touch items-center gap-3 rounded-panel border border-line border-l-2 border-l-warn bg-panel px-4 py-3 no-underline"
                >
                  <AlertTriangle size={20} strokeWidth={1.5} className="shrink-0 text-warn" aria-hidden />
                  <span>
                    <span className="font-semibold">{r.name}</span> has no current price
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
