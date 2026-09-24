import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Pencil, Plus, Power } from 'lucide-react'
import {
  ActivePill,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  DataTable,
  ErrorState,
  Facts,
  PageHeader,
  Section,
  SkeletonBlock,
  useToast,
} from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { CustomerSite } from '@/services/customerSites'
import { useCustomer, useSaveSite, useSetCustomerActive, useSites } from './api'
import { TermsPill } from './CustomerListPage'
import { CUSTOMER_TYPE_LABEL } from './labels'
import { SiteFormModal } from './SiteFormModal'

function mapsUrl(s: CustomerSite) {
  return `https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`
}

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const { canWriteMasterData } = useRole()
  const toast = useToast()
  const q = useCustomer(id)
  const setActive = useSetCustomerActive()
  const [confirm, setConfirm] = useState(false)

  if (q.isLoading) {
    return (
      <>
        <PageHeader title={<SkeletonBlock className="h-8 w-[220px]" />} back={{ to: '/customers', label: 'Customers' }} />
        <SkeletonBlock className="h-[160px] w-full" />
      </>
    )
  }
  if (q.isError || !q.data) {
    return (
      <>
        <PageHeader title="Customer" back={{ to: '/customers', label: 'Customers' }} />
        <ErrorState what="Could not load this customer." error={q.error} onRetry={() => void q.refetch()} />
      </>
    )
  }
  const c = q.data

  return (
    <>
      <PageHeader
        title={c.name}
        back={{ to: '/customers', label: 'Customers' }}
        meta={
          <>
            <ActivePill active={c.is_active} />
            <TermsPill terms={c.payment_terms} />
          </>
        }
        action={
          canWriteMasterData && (
            <ButtonLink to={`/customers/${c.id}/edit`} variant="secondary" icon={<Pencil size={20} strokeWidth={1.5} aria-hidden />}>
              Edit
            </ButtonLink>
          )
        }
      />
      <Card emphasis>
        <Facts
          items={[
            { label: 'Phone', value: <a className="num inline-flex min-h-touch items-center underline underline-offset-4" href={`tel:${c.phone}`}>{c.phone}</a> },
            { label: 'Alternative phone', value: c.alt_phone ? <a className="num inline-flex min-h-touch items-center underline underline-offset-4" href={`tel:${c.alt_phone}`}>{c.alt_phone}</a> : '—' },
            { label: 'Type', value: CUSTOMER_TYPE_LABEL[c.customer_type as 'company'] ?? c.customer_type },
            { label: 'Payment terms', value: c.payment_terms === 'credit' ? 'Credit' : 'Prepaid' },
            { label: 'Credit cap', value: formatNumber(c.credit_load_cap, 'loads'), numeric: true },
            { label: 'Credit days', value: formatNumber(c.credit_days, 'days'), numeric: true },
            { label: 'Notes', value: c.notes || '—' },
            { label: 'Last changed', value: formatDateTime(c.updated_at ?? c.created_at), numeric: true },
          ]}
        />
        {canWriteMasterData && (
          <div className="mt-6 border-t border-line pt-4">
            <Button
              variant={c.is_active ? 'secondary' : 'primary'}
              block
              className="md:w-auto"
              icon={<Power size={20} strokeWidth={1.5} aria-hidden />}
              onClick={() => setConfirm(true)}
            >
              {c.is_active ? 'Deactivate customer' : 'Reactivate customer'}
            </Button>
          </div>
        )}
      </Card>

      <SitesSection customerId={c.id} canWrite={canWriteMasterData} />

      <ConfirmDialog
        open={confirm}
        title={c.is_active ? `Deactivate ${c.name}?` : `Reactivate ${c.name}?`}
        message={
          c.is_active
            ? 'They will no longer appear when creating orders. Their history is kept and you can reactivate them later.'
            : 'They will appear again when creating orders.'
        }
        confirmLabel={c.is_active ? 'Deactivate' : 'Reactivate'}
        tone={c.is_active ? 'danger' : 'primary'}
        loading={setActive.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await setActive.mutateAsync({ id: c.id, active: !c.is_active })
            toast.success(c.is_active ? `${c.name} deactivated.` : `${c.name} reactivated.`)
            setConfirm(false)
          } catch (err) {
            toast.error(err)
          }
        }}
      />
    </>
  )
}

function SitesSection({ customerId, canWrite }: { customerId: string; canWrite: boolean }) {
  const q = useSites(customerId)
  const toast = useToast()
  const save = useSaveSite(customerId)
  const [editing, setEditing] = useState<CustomerSite | null>(null)
  const [adding, setAdding] = useState(false)
  const [toggling, setToggling] = useState<CustomerSite | null>(null)

  const addButton = canWrite ? (
    <Button variant="secondary" icon={<Plus size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setAdding(true)}>
      Add site
    </Button>
  ) : undefined

  const coords = (s: CustomerSite) =>
    s.latitude != null && s.longitude != null ? (
      <a href={mapsUrl(s)} target="_blank" rel="noreferrer" className="num inline-flex min-h-touch items-center gap-1 underline underline-offset-4 md:min-h-0">
        <MapPin size={16} strokeWidth={1.5} aria-hidden />
        {Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}
      </a>
    ) : (
      <span className="text-ink-3">No coordinates</span>
    )

  const rowActions = (s: CustomerSite) =>
    canWrite ? (
      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
        <Button variant="secondary" block className="md:w-auto md:min-h-row md:h-row" onClick={() => setEditing(s)} icon={<Pencil size={16} strokeWidth={1.5} aria-hidden />}>
          Edit
        </Button>
        <Button variant="ghost" block className="md:w-auto md:min-h-row md:h-row" onClick={() => setToggling(s)}>
          {s.is_active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </div>
    ) : null

  return (
    <Section title="Delivery sites" action={addButton}>
      <DataTable
        noun="sites"
        caption="Delivery sites"
        rows={q.data}
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(s) => s.id}
        skeletonRows={2}
        emptyMessage="No delivery sites yet."
        emptyAction={addButton}
        columns={[
          { key: 'name', header: 'Site', render: (s) => <span className="font-semibold">{s.name}</span> },
          { key: 'area', header: 'Area', render: (s) => s.area },
          { key: 'coords', header: 'Coordinates', render: coords },
          { key: 'radius', header: 'Geofence', align: 'right', render: (s) => formatNumber(s.geofence_radius_m, 'm') },
          { key: 'status', header: 'Status', render: (s) => <ActivePill active={s.is_active} /> },
          ...(canWrite ? [{ key: 'actions', header: 'Actions', align: 'right' as const, render: rowActions }] : []),
        ]}
        mobile={{
          title: (s) => s.name,
          lines: (s) => (
            <>
              <span>{s.area}</span>
              {coords(s)}
              {s.directions && <span className="text-ink-3">{s.directions}</span>}
            </>
          ),
          figure: (s) => formatNumber(s.geofence_radius_m, 'm'),
          figureCaption: (s) => <ActivePill active={s.is_active} />,
          actions: canWrite ? rowActions : undefined,
        }}
      />
      <SiteFormModal open={adding} onClose={() => setAdding(false)} customerId={customerId} />
      <SiteFormModal open={Boolean(editing)} onClose={() => setEditing(null)} customerId={customerId} site={editing} />
      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.is_active ? `Deactivate site ${toggling?.name}?` : `Reactivate site ${toggling?.name}?`}
        message={toggling?.is_active ? 'New orders cannot be sent to this site. Past deliveries are kept.' : 'New orders can be sent to this site again.'}
        confirmLabel={toggling?.is_active ? 'Deactivate site' : 'Reactivate site'}
        tone={toggling?.is_active ? 'danger' : 'primary'}
        loading={save.isPending}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return
          try {
            await save.mutateAsync({ id: toggling.id, input: { is_active: !toggling.is_active } })
            toast.success('Site updated.')
            setToggling(null)
          } catch (err) {
            toast.error(err)
          }
        }}
      />
    </Section>
  )
}
