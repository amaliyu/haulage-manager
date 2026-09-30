import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ButtonLink, DataTable, FilterPills, PageHeader, SearchInput } from '@/components/ui'
import { useDebounced } from '@/hooks/useDebounced'
import { useRole } from '@/hooks/useRole'
import { formatDateTime, formatNaira } from '@/lib/format'
import { orderTotals, type OrderStatusFilter } from '@/services/orders'
import { useOrders } from './api'
import { OrderStatusPill } from './labels'

export function OrderListPage() {
  const { canDispatch } = useRole()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatusFilter>('open')
  const f = { status, search: useDebounced(search) }
  const q = useOrders(f)

  const newButton = canDispatch ? (
    <ButtonLink to="/orders/new" icon={<Plus size={20} strokeWidth={1.5} aria-hidden />}>
      New order
    </ButtonLink>
  ) : undefined
  const filtered = Boolean(f.search) || status !== 'open'

  return (
    <>
      <PageHeader title="Orders" action={newButton} />
      <div className="mb-4 flex flex-col gap-3">
        <SearchInput label="Search orders" value={search} onChange={setSearch} placeholder="Search order number or customer" />
        <FilterPills
          label="Order status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'awaiting_payment', label: 'Awaiting payment' },
            { value: 'ready', label: 'Ready' },
            { value: 'in_progress', label: 'In progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      <DataTable
        noun="orders"
        caption="Orders"
        rows={q.data}
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(o) => o.id}
        rowHref={(o) => `/orders/${o.id}`}
        emptyMessage={filtered ? 'No orders match these filters.' : 'No open orders.'}
        emptyAction={filtered ? undefined : newButton}
        columns={[
          { key: 'number', header: 'Order', render: (o) => <span className="num whitespace-nowrap font-semibold">{o.order_number}</span> },
          { key: 'customer', header: 'Customer', render: (o) => o.customer?.name ?? '—' },
          { key: 'route', header: 'Route', render: (o) => o.route?.name ?? '—' },
          {
            key: 'trips',
            header: 'Trips done',
            align: 'right',
            render: (o) => {
              const t = orderTotals(o)
              return <span className="num">{t.done} of {t.live}</span>
            },
          },
          { key: 'total', header: 'Total', align: 'right', render: (o) => <span className="num">{formatNaira(orderTotals(o).total)}</span> },
          { key: 'created', header: 'Placed', render: (o) => <span className="num">{formatDateTime(o.created_at)}</span> },
          { key: 'status', header: 'Status', render: (o) => <OrderStatusPill status={o.status} /> },
        ]}
        mobile={{
          title: (o) => (
            <>
              <span className="num">{o.order_number}</span> · {o.customer?.name ?? '—'}
            </>
          ),
          lines: (o) => {
            const t = orderTotals(o)
            return (
              <>
                <span>{o.route?.name ?? '—'}</span>
                <span className="num">
                  {t.done} of {t.live} trips done · {formatDateTime(o.created_at)}
                </span>
              </>
            )
          },
          figure: (o) => formatNaira(orderTotals(o).total),
          figureCaption: (o) => <OrderStatusPill status={o.status} />,
        }}
      />
    </>
  )
}
