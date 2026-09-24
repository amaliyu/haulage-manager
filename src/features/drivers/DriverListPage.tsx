import { useState } from 'react'
import { Link2, Plus } from 'lucide-react'
import { ActivePill, ButtonLink, DataTable, FilterPills, PageHeader, SearchInput } from '@/components/ui'
import { useDebounced } from '@/hooks/useDebounced'
import { useRole } from '@/hooks/useRole'
import type { ActiveFilter } from '@/services/_shared'
import { useDrivers } from './api'

export function DriverListPage() {
  const { canWriteMasterData } = useRole()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<ActiveFilter>('active')
  const q = useDrivers({ search: useDebounced(search), active })

  const newButton = canWriteMasterData ? (
    <ButtonLink to="/drivers/new" icon={<Plus size={20} strokeWidth={1.5} aria-hidden />}>
      New driver
    </ButtonLink>
  ) : undefined
  const filtered = Boolean(search) || active !== 'active'

  return (
    <>
      <PageHeader title="Drivers" action={newButton} meta={!canWriteMasterData && <span>Read only</span>} />
      <div className="mb-4 flex flex-col gap-3">
        <SearchInput label="Search drivers" value={search} onChange={setSearch} placeholder="Search name, phone or licence" />
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
        noun="drivers"
        caption="Drivers"
        rows={q.data}
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(d) => d.id}
        rowHref={canWriteMasterData ? (d) => `/drivers/${d.id}/edit` : undefined}
        emptyMessage={filtered ? 'No drivers match these filters.' : 'No drivers yet.'}
        emptyAction={filtered ? undefined : newButton}
        columns={[
          { key: 'name', header: 'Driver', render: (d) => <span className="font-semibold">{d.full_name}</span> },
          { key: 'phone', header: 'Phone', render: (d) => <a href={`tel:${d.phone}`} className="num inline-flex min-h-row items-center underline underline-offset-4">{d.phone}</a> },
          { key: 'licence', header: 'Licence', render: (d) => <span className="num">{d.licence_number ?? '—'}</span> },
          { key: 'truck', header: 'Truck', render: (d) => (d.truck ? <span className="num font-semibold">{d.truck.plate_number}</span> : <span className="text-ink-3">Unassigned</span>) },
          {
            key: 'login',
            header: 'App login',
            render: (d) =>
              d.profile_id ? (
                <span className="inline-flex items-center gap-1 text-ink-2">
                  <Link2 size={16} strokeWidth={1.5} aria-hidden /> Linked
                </span>
              ) : (
                <span className="text-ink-3">Not linked</span>
              ),
          },
          { key: 'status', header: 'Status', render: (d) => <ActivePill active={d.is_active} /> },
        ]}
        mobile={{
          title: (d) => d.full_name,
          lines: (d) => (
            <>
              <span className="num">{d.phone}</span>
              <span>{d.profile_id ? 'App login linked' : 'No app login'}</span>
            </>
          ),
          figure: (d) => (d.truck ? d.truck.plate_number : <span className="text-small font-semibold text-ink-3">No truck</span>),
          figureCaption: (d) => (d.is_active ? undefined : <ActivePill active={false} />),
        }}
      />
    </>
  )
}
