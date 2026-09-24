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

export function StaffHomePage() {
  const profile = useProfile()
  const customers = useCustomers({ search: '', type: 'all', terms: 'all', active: 'active' })
  const routes = useRoutes({ active: 'active' })
  const trucks = useTrucks({ active: 'active' })
  const drivers = useDrivers({ active: 'active' })
  const diesel = useDieselPrices()

  const pump = diesel.data?.find((d) => d.effective_to === null)
  const unpriced = routes.data?.filter((r) => !r.current_price) ?? []
  const available = trucks.data?.filter((t) => t.status === 'available').length ?? 0
  const noPhoto = trucks.data?.filter((t) => !t.reference_load_photo_url).length ?? 0
  const unassigned = drivers.data?.filter((d) => !d.assigned_truck_id).length ?? 0
  const credit = customers.data?.filter((c) => c.payment_terms === 'credit').length ?? 0
  const failed = [customers, routes, trucks, drivers, diesel].filter((x) => x.isError)

  return (
    <>
      <PageHeader title="Overview" meta={<span>{profile.full_name} · {ROLE_LABEL[profile.role]}</span>} />
      {failed.length > 0 && (
        <div className="mb-4">
          <ErrorState what="Some figures could not load." error={failed[0].error} onRetry={() => failed.forEach((f) => void f.refetch())} />
        </div>
      )}
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
          context={unpriced.length ? `${unpriced.length} without a price` : 'All priced'}
        />
        <MetricTile
          label="Trucks available"
          to="/trucks"
          loading={trucks.isLoading}
          value={trucks.data ? `${available} of ${trucks.data.length}` : '—'}
          context={noPhoto ? `${noPhoto} missing a reference photo` : 'All have reference photos'}
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
          context={unassigned ? `${unassigned} without a truck` : 'All have a truck'}
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
