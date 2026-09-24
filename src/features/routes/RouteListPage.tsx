import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ActivePill, ButtonLink, DataTable, FilterPills, PageHeader, SearchInput, StatusPill } from '@/components/ui'
import { useDebounced } from '@/hooks/useDebounced'
import { useRole } from '@/hooks/useRole'
import { formatNaira, formatNumber } from '@/lib/format'
import type { ActiveFilter } from '@/services/_shared'
import type { RouteWithCurrent } from '@/services/routes'
import { useRoutes } from './api'
import { tripEconomics } from './economics'

function margin(r: RouteWithCurrent) {
  return r.current_price ? tripEconomics(r.current_price, Number(r.diesel_allowance_litres)).margin : null
}

export function RouteListPage() {
  const { canWriteMasterData } = useRole()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<ActiveFilter>('active')
  const q = useRoutes({ search: useDebounced(search), active })

  const newButton = canWriteMasterData ? (
    <ButtonLink to="/routes/new" icon={<Plus size={20} strokeWidth={1.5} aria-hidden />}>
      New route
    </ButtonLink>
  ) : undefined
  const filtered = Boolean(search) || active !== 'active'

  return (
    <>
      <PageHeader title="Routes" action={newButton} meta={!canWriteMasterData && <span>Read only</span>} />
      <div className="mb-4 flex flex-col gap-3">
        <SearchInput label="Search routes" value={search} onChange={setSearch} placeholder="Search route or destination" />
        <FilterPills
          label="Status"
          value={active}
          onChange={setActive}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      <DataTable
        noun="routes"
        caption="Routes with current price"
        rows={q.data}
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(r) => r.id}
        rowHref={(r) => `/routes/${r.id}`}
        emptyMessage={filtered ? 'No routes match these filters.' : 'No routes yet.'}
        emptyAction={filtered ? undefined : newButton}
        columns={[
          { key: 'name', header: 'Route', render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: 'source', header: 'Source', render: (r) => r.source?.name ?? '—' },
          { key: 'dest', header: 'Destination', render: (r) => r.destination_area },
          { key: 'litres', header: 'Diesel', align: 'right', render: (r) => formatNumber(Number(r.diesel_allowance_litres), 'L') },
          {
            key: 'price',
            header: 'Price / trip',
            align: 'right',
            render: (r) => (r.current_price ? <span className="font-semibold">{formatNaira(r.current_price.customer_price)}</span> : <StatusPill tone="warn">No price</StatusPill>),
          },
          { key: 'margin', header: 'Margin / trip', align: 'right', render: (r) => { const m = margin(r); return m === null ? '—' : <span className={m < 0 ? 'text-danger' : undefined}>{formatNaira(m)}</span> } },
          { key: 'status', header: 'Status', render: (r) => <ActivePill active={r.is_active} /> },
        ]}
        mobile={{
          title: (r) => r.name,
          lines: (r) => (
            <>
              <span>
                {r.source?.name ?? '—'} · {formatNumber(Number(r.diesel_allowance_litres), 'L')}
              </span>
              {margin(r) !== null && <span className="num">Margin {formatNaira(margin(r))}</span>}
            </>
          ),
          figure: (r) => (r.current_price ? formatNaira(r.current_price.customer_price) : undefined),
          figureCaption: (r) => (r.current_price ? (r.is_active ? undefined : <ActivePill active={false} />) : <StatusPill tone="warn">No price</StatusPill>),
        }}
      />
    </>
  )
}
