import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ActivePill, ButtonLink, DataTable, FilterPills, PageHeader, SearchInput, StatusPill } from '@/components/ui'
import { useDebounced } from '@/hooks/useDebounced'
import { useRole } from '@/hooks/useRole'
import { formatNumber } from '@/lib/format'
import type { Customer, CustomerFilters } from '@/services/customers'
import { useCustomers } from './api'
import { CUSTOMER_TYPE_LABEL, PAYMENT_TERMS_LABEL } from './labels'

export function TermsPill({ terms }: { terms: Customer['payment_terms'] }) {
  return (
    <StatusPill tone={terms === 'credit' ? 'warn' : 'info'}>
      {PAYMENT_TERMS_LABEL[terms as keyof typeof PAYMENT_TERMS_LABEL] ?? terms}
    </StatusPill>
  )
}

export function CustomerListPage() {
  const { canWriteMasterData } = useRole()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<CustomerFilters['type']>('all')
  const [terms, setTerms] = useState<CustomerFilters['terms']>('all')
  const [active, setActive] = useState<CustomerFilters['active']>('active')
  const filters: CustomerFilters = { search: useDebounced(search), type, terms, active }
  const q = useCustomers(filters)

  const newButton = canWriteMasterData ? (
    <ButtonLink to="/customers/new" icon={<Plus size={20} strokeWidth={1.5} aria-hidden />}>
      New customer
    </ButtonLink>
  ) : undefined

  const filtered = Boolean(filters.search) || type !== 'all' || terms !== 'all' || active !== 'active'

  return (
    <>
      <PageHeader title="Customers" action={newButton} meta={!canWriteMasterData && <span>Read only</span>} />
      <div className="mb-4 flex flex-col gap-3">
        <SearchInput label="Search customers" value={search} onChange={setSearch} placeholder="Search name or phone" />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <FilterPills
            label="Customer type"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'company', label: 'Company' },
              { value: 'individual', label: 'Individual' },
            ]}
          />
          <FilterPills
            label="Payment terms"
            value={terms}
            onChange={setTerms}
            options={[
              { value: 'all', label: 'All terms' },
              { value: 'prepaid', label: 'Prepaid' },
              { value: 'credit', label: 'Credit' },
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
        noun="customers"
        caption="Customers"
        rows={q.data}
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(c) => c.id}
        rowHref={(c) => `/customers/${c.id}`}
        emptyMessage={filtered ? 'No customers match these filters.' : 'No customers yet.'}
        emptyAction={filtered ? undefined : newButton}
        columns={[
          { key: 'name', header: 'Customer', render: (c) => <span className="font-semibold">{c.name}</span> },
          { key: 'phone', header: 'Phone', render: (c) => <span className="num">{c.phone}</span> },
          { key: 'type', header: 'Type', render: (c) => CUSTOMER_TYPE_LABEL[c.customer_type as 'company'] ?? c.customer_type },
          { key: 'terms', header: 'Terms', render: (c) => <TermsPill terms={c.payment_terms} /> },
          { key: 'cap', header: 'Credit cap', align: 'right', render: (c) => (c.payment_terms === 'credit' ? formatNumber(c.credit_load_cap, 'loads') : '—') },
          { key: 'days', header: 'Credit days', align: 'right', render: (c) => (c.payment_terms === 'credit' ? formatNumber(c.credit_days) : '—') },
          { key: 'status', header: 'Status', render: (c) => <ActivePill active={c.is_active} /> },
        ]}
        mobile={{
          title: (c) => c.name,
          lines: (c) => (
            <>
              <span className="num">{c.phone}</span>
              <span>{CUSTOMER_TYPE_LABEL[c.customer_type as 'company'] ?? c.customer_type}{!c.is_active && ' · Inactive'}</span>
            </>
          ),
          figure: (c) => (c.payment_terms === 'credit' ? formatNumber(c.credit_load_cap, 'loads') : undefined),
          figureCaption: (c) => <TermsPill terms={c.payment_terms} />,
        }}
      />
    </>
  )
}
