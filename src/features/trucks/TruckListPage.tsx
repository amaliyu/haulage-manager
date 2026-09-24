import { useState } from 'react'
import { Camera, Plus } from 'lucide-react'
import { ButtonLink, DataTable, FilterPills, PageHeader, SearchInput } from '@/components/ui'
import { useDebounced } from '@/hooks/useDebounced'
import { useRole } from '@/hooks/useRole'
import { formatNumber } from '@/lib/format'
import type { ActiveFilter } from '@/services/_shared'
import type { OwnerType } from '@/services/trucks'
import { useTrucks } from './api'
import { ownerLabel, TruckStatusPill } from './labels'

export function TruckListPage() {
  const { canWriteMasterData } = useRole()
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState<'all' | OwnerType>('all')
  const [active, setActive] = useState<ActiveFilter>('active')
  const q = useTrucks({ search: useDebounced(search), owner, active })

  const newButton = canWriteMasterData ? (
    <ButtonLink to="/trucks/new" icon={<Plus size={20} strokeWidth={1.5} aria-hidden />}>
      New truck
    </ButtonLink>
  ) : undefined
  const filtered = Boolean(search) || owner !== 'all' || active !== 'active'

  return (
    <>
      <PageHeader title="Trucks" action={newButton} meta={!canWriteMasterData && <span>Read only</span>} />
      <div className="mb-4 flex flex-col gap-3">
        <SearchInput label="Search trucks" value={search} onChange={setSearch} placeholder="Search plate, make or owner" />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <FilterPills
            label="Owner"
            value={owner}
            onChange={setOwner}
            options={[
              { value: 'all', label: 'All owners' },
              { value: 'spv', label: 'SPV' },
              { value: 'operator', label: 'Operator' },
              { value: 'partner', label: 'Partner' },
            ]}
          />
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
      </div>
      <DataTable
        noun="trucks"
        caption="Trucks"
        rows={q.data}
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(t) => t.id}
        rowHref={(t) => `/trucks/${t.id}`}
        emptyMessage={filtered ? 'No trucks match these filters.' : 'No trucks yet.'}
        emptyAction={filtered ? undefined : newButton}
        columns={[
          { key: 'plate', header: 'Plate', render: (t) => <span className="num font-semibold">{t.plate_number}</span> },
          { key: 'make', header: 'Make / model', render: (t) => [t.make, t.model].filter(Boolean).join(' ') || '—' },
          { key: 'owner', header: 'Owner', render: (t) => `${ownerLabel(t.owner_type)}${t.owner_name ? ` · ${t.owner_name}` : ''}` },
          { key: 'cap', header: 'Capacity', align: 'right', render: (t) => (t.capacity_tons != null ? formatNumber(Number(t.capacity_tons), 't') : '—') },
          {
            key: 'photo',
            header: 'Ref. photo',
            render: (t) =>
              t.reference_load_photo_url ? (
                <span className="inline-flex items-center gap-1 text-ink-2">
                  <Camera size={16} strokeWidth={1.5} aria-hidden /> On file
                </span>
              ) : (
                <span className="text-ink-3">Missing</span>
              ),
          },
          { key: 'status', header: 'Status', render: (t) => <TruckStatusPill status={t.is_active ? t.status : 'inactive'} /> },
        ]}
        mobile={{
          title: (t) => <span className="num">{t.plate_number}</span>,
          lines: (t) => (
            <>
              <span>{[t.make, t.model].filter(Boolean).join(' ') || 'Make not recorded'}</span>
              <span>
                {ownerLabel(t.owner_type)}
                {t.owner_name ? ` · ${t.owner_name}` : ''}
                {!t.reference_load_photo_url && ' · No reference photo'}
              </span>
            </>
          ),
          figure: (t) => (t.capacity_tons != null ? formatNumber(Number(t.capacity_tons), 't') : undefined),
          figureCaption: (t) => <TruckStatusPill status={t.is_active ? t.status : 'inactive'} />,
        }}
      />
    </>
  )
}
