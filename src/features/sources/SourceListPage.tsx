import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { ActivePill, Button, ConfirmDialog, DataTable, FilterPills, PageHeader, SearchInput, useToast } from '@/components/ui'
import { useDebounced } from '@/hooks/useDebounced'
import { useRole } from '@/hooks/useRole'
import { formatNaira } from '@/lib/format'
import type { ActiveFilter } from '@/services/_shared'
import type { MaterialSource } from '@/services/materialSources'
import { useSaveSource, useSources } from './api'
import { materialLabel } from './labels'
import { SourceFormModal } from './SourceFormModal'

export function SourceListPage() {
  const { canWriteMasterData } = useRole()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<ActiveFilter>('active')
  const q = useSources({ search: useDebounced(search), active })
  const save = useSaveSource()
  const [editing, setEditing] = useState<MaterialSource | null>(null)
  const [adding, setAdding] = useState(false)
  const [toggling, setToggling] = useState<MaterialSource | null>(null)

  const addButton = canWriteMasterData ? (
    <Button icon={<Plus size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setAdding(true)}>
      New source
    </Button>
  ) : undefined

  const actions = (s: MaterialSource) =>
    canWriteMasterData ? (
      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
        <Button variant="secondary" block className="md:h-row md:min-h-row md:w-auto" onClick={() => setEditing(s)} icon={<Pencil size={16} strokeWidth={1.5} aria-hidden />}>
          Edit
        </Button>
        <Button variant="ghost" block className="md:h-row md:min-h-row md:w-auto" onClick={() => setToggling(s)}>
          {s.is_active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </div>
    ) : null

  const filtered = Boolean(search) || active !== 'active'

  return (
    <>
      <PageHeader title="Material sources" action={addButton} meta={!canWriteMasterData && <span>Read only</span>} />
      <div className="mb-4 flex flex-col gap-3">
        <SearchInput label="Search sources" value={search} onChange={setSearch} placeholder="Search name or area" />
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
        noun="material sources"
        caption="Material sources"
        rows={q.data}
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(s) => s.id}
        emptyMessage={filtered ? 'No sources match these filters.' : 'No material sources yet.'}
        emptyAction={filtered ? undefined : addButton}
        columns={[
          { key: 'name', header: 'Source', render: (s) => <span className="font-semibold">{s.name}</span> },
          { key: 'material', header: 'Material', render: (s) => materialLabel(s.material) },
          { key: 'area', header: 'Area', render: (s) => s.area ?? '—' },
          { key: 'cost', header: 'Material cost', align: 'right', render: (s) => formatNaira(s.default_material_cost) },
          { key: 'status', header: 'Status', render: (s) => <ActivePill active={s.is_active} /> },
          ...(canWriteMasterData ? [{ key: 'actions', header: 'Actions', align: 'right' as const, render: actions }] : []),
        ]}
        mobile={{
          title: (s) => s.name,
          lines: (s) => (
            <span>
              {materialLabel(s.material)}
              {s.area ? ` · ${s.area}` : ''}
            </span>
          ),
          figure: (s) => formatNaira(s.default_material_cost),
          figureCaption: (s) => <ActivePill active={s.is_active} />,
          actions: canWriteMasterData ? actions : undefined,
        }}
      />
      <SourceFormModal open={adding} onClose={() => setAdding(false)} />
      <SourceFormModal open={Boolean(editing)} onClose={() => setEditing(null)} source={editing} />
      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.is_active ? `Deactivate ${toggling?.name}?` : `Reactivate ${toggling?.name}?`}
        message={
          toggling?.is_active
            ? 'Its routes stay on record, but the source will not be offered for new trips.'
            : 'The source will be offered for new trips again.'
        }
        confirmLabel={toggling?.is_active ? 'Deactivate' : 'Reactivate'}
        tone={toggling?.is_active ? 'danger' : 'primary'}
        loading={save.isPending}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return
          try {
            await save.mutateAsync({ id: toggling.id, input: { is_active: !toggling.is_active } })
            toast.success(`${toggling.name} ${toggling.is_active ? 'deactivated' : 'reactivated'}.`)
            setToggling(null)
          } catch (err) {
            toast.error(err)
          }
        }}
      />
    </>
  )
}
