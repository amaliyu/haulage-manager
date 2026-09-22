import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pencil, Power, Tag } from 'lucide-react'
import {
  ActivePill,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Facts,
  MetricTile,
  PageHeader,
  Section,
  SkeletonBlock,
  StatusPill,
  useToast,
} from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { formatDateTime, formatNaira, formatNumber } from '@/lib/format'
import { materialLabel } from '@/features/sources/labels'
import { useRoute, useRoutePriceHistory, useSaveRoute } from './api'
import { ChangePriceModal } from './ChangePriceModal'
import { tripEconomics } from './economics'

export function RouteDetailPage() {
  const { id = '' } = useParams()
  const { canWriteMasterData } = useRole()
  const toast = useToast()
  const q = useRoute(id)
  const history = useRoutePriceHistory(id)
  const save = useSaveRoute()
  const [changing, setChanging] = useState(false)
  const [toggling, setToggling] = useState(false)

  if (q.isLoading) {
    return (
      <>
        <PageHeader title={<SkeletonBlock className="h-8 w-[220px]" />} back={{ to: '/routes', label: 'Routes' }} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBlock key={i} className="h-[96px]" />
          ))}
        </div>
      </>
    )
  }
  if (q.isError || !q.data) {
    return (
      <>
        <PageHeader title="Route" back={{ to: '/routes', label: 'Routes' }} />
        <ErrorState what="Could not load this route." error={q.error} onRetry={() => void q.refetch()} />
      </>
    )
  }
  const r = q.data
  const p = r.current_price
  const litres = Number(r.diesel_allowance_litres)
  const econ = p ? tripEconomics(p, litres) : null

  const changeButton = canWriteMasterData ? (
    <Button icon={<Tag size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setChanging(true)}>
      {p ? 'Change price' : 'Set price'}
    </Button>
  ) : undefined

  return (
    <>
      <PageHeader
        title={r.name}
        back={{ to: '/routes', label: 'Routes' }}
        meta={<ActivePill active={r.is_active} />}
        action={
          canWriteMasterData && (
            <ButtonLink to={`/routes/${r.id}/edit`} variant="secondary" icon={<Pencil size={20} strokeWidth={1.5} aria-hidden />}>
              Edit
            </ButtonLink>
          )
        }
      />

      <Section title="Current price" action={changeButton}>
        {p && econ ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile label="Customer price per trip" value={formatNaira(p.customer_price)} context={`Since ${formatDateTime(p.effective_from)}`} />
              <MetricTile
                label="Margin per trip"
                value={<span className={econ.margin < 0 ? 'text-danger' : undefined}>{formatNaira(econ.margin)}</span>}
                context={econ.margin < 0 ? 'Loss on every trip at this price' : 'Before truck repayment'}
                emphasis
              />
            </div>
            <table className="num mt-3 w-full rounded-panel border border-line bg-panel text-body">
              <caption className="sr-only">Cost per trip</caption>
              <thead>
                <tr className="h-row border-b border-line bg-surface-2">
                  <th scope="col" className="micro-label rounded-tl-panel px-4 text-left">Cost per trip</th>
                  <th scope="col" className="micro-label rounded-tr-panel px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-row border-b border-line">
                  <td className="px-4 py-2">Material</td>
                  <td className="px-4 py-2 text-right">{formatNaira(p.material_cost)}</td>
                </tr>
                <tr className="h-row border-b border-line">
                  <td className="px-4 py-2">
                    Diesel <span className="text-small text-ink-3">{formatNumber(litres, 'L')} at {formatNaira(p.diesel_price_per_litre)}/L</span>
                  </td>
                  <td className="px-4 py-2 text-right">{formatNaira(econ.diesel)}</td>
                </tr>
                <tr className="h-row border-b border-line">
                  <td className="px-4 py-2">Crew</td>
                  <td className="px-4 py-2 text-right">{formatNaira(p.crew_cost)}</td>
                </tr>
                <tr className="h-row">
                  <td className="px-4 py-2 font-semibold">Total cost</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatNaira(econ.costs)}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <EmptyState message="This route has no current price. Trips cannot be ordered on it yet." action={changeButton} />
        )}
      </Section>

      <Section title="Route details">
        <Card>
          <Facts
            items={[
              { label: 'Source', value: r.source ? `${r.source.name} (${materialLabel(r.source.material)})` : '—' },
              { label: 'Destination area', value: r.destination_area },
              { label: 'Diesel allowance', value: formatNumber(litres, 'litres'), numeric: true },
              { label: 'Distance', value: r.distance_km != null ? formatNumber(Number(r.distance_km), 'km') : '—', numeric: true },
            ]}
          />
          {canWriteMasterData && (
            <div className="mt-6 border-t border-line pt-4">
              <Button variant={r.is_active ? 'secondary' : 'primary'} block className="md:w-auto" icon={<Power size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setToggling(true)}>
                {r.is_active ? 'Deactivate route' : 'Reactivate route'}
              </Button>
            </div>
          )}
        </Card>
      </Section>

      <Section title="Price history">
        <DataTable
          noun="price history"
          caption="Price history, newest first"
          rows={history.data}
          isLoading={history.isLoading}
          isError={history.isError}
          error={history.error}
          onRetry={() => void history.refetch()}
          rowKey={(h) => h.id}
          skeletonRows={3}
          emptyMessage="No prices recorded for this route yet."
          columns={[
            { key: 'from', header: 'From', render: (h) => <span className="num">{formatDateTime(h.effective_from)}</span> },
            { key: 'to', header: 'To', render: (h) => (h.effective_to ? <span className="num">{formatDateTime(h.effective_to)}</span> : <StatusPill tone="ok">Current</StatusPill>) },
            { key: 'price', header: 'Customer', align: 'right', render: (h) => <span className="font-semibold">{formatNaira(h.customer_price)}</span> },
            { key: 'material', header: 'Material', align: 'right', render: (h) => formatNaira(h.material_cost) },
            { key: 'crew', header: 'Crew', align: 'right', render: (h) => formatNaira(h.crew_cost) },
            { key: 'diesel', header: 'Diesel /L', align: 'right', render: (h) => formatNaira(h.diesel_price_per_litre) },
            { key: 'margin', header: 'Margin', align: 'right', render: (h) => formatNaira(tripEconomics(h, litres).margin) },
            { key: 'by', header: 'Set by', render: (h) => h.setter?.full_name ?? '—' },
            { key: 'note', header: 'Note', render: (h) => <span className="text-ink-2">{h.note ?? '—'}</span> },
          ]}
          mobile={{
            title: (h) => <span className="num">{formatDateTime(h.effective_from)}</span>,
            lines: (h) => (
              <>
                <span className="num">
                  Material {formatNaira(h.material_cost)} · Crew {formatNaira(h.crew_cost)}
                </span>
                <span className="num">Diesel {formatNaira(h.diesel_price_per_litre)}/L</span>
                {h.effective_to && <span className="num">Until {formatDateTime(h.effective_to)}</span>}
                {h.note && <span className="text-ink-3">{h.note}</span>}
              </>
            ),
            figure: (h) => formatNaira(h.customer_price),
            figureCaption: (h) => (h.effective_to ? <StatusPill tone="neutral">Closed</StatusPill> : <StatusPill tone="ok">Current</StatusPill>),
          }}
        />
      </Section>

      <ChangePriceModal open={changing} onClose={() => setChanging(false)} route={r} />
      <ConfirmDialog
        open={toggling}
        title={r.is_active ? `Deactivate ${r.name}?` : `Reactivate ${r.name}?`}
        message={r.is_active ? 'No new orders can be placed on this route. Its price history is kept.' : 'New orders can be placed on this route again.'}
        confirmLabel={r.is_active ? 'Deactivate route' : 'Reactivate route'}
        tone={r.is_active ? 'danger' : 'primary'}
        loading={save.isPending}
        onClose={() => setToggling(false)}
        onConfirm={async () => {
          try {
            await save.mutateAsync({ id: r.id, input: { is_active: !r.is_active } })
            toast.success(`${r.name} ${r.is_active ? 'deactivated' : 'reactivated'}.`)
            setToggling(false)
          } catch (err) {
            toast.error(err)
          }
        }}
      />
    </>
  )
}
