import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, ShieldCheck, UserPlus } from 'lucide-react'
import {
  ActivePill,
  Button,
  ConfirmDialog,
  DataTable,
  FilterPills,
  FormGrid,
  Modal,
  PageHeader,
  SearchInput,
  SelectField,
  StatusPill,
  TextField,
  useToast,
} from '@/components/ui'
import { useProfile } from '@/hooks/useAuth'
import { ROLE_LABEL } from '@/hooks/useRole'
import { formatDateTime } from '@/lib/format'
import { optionalPhone, requiredText } from '@/lib/zod'
import { ROLES, type Profile, type Role } from '@/services/profiles'
import { useCreateProfile, useProfiles, useUpdateProfile } from './api'

const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))

const newSchema = z.object({
  id: z.string().trim().uuid('Paste the user UID from Supabase: 36 characters with dashes'),
  full_name: requiredText('Full name', 120),
  phone: optionalPhone('Phone'),
  role: z.enum(ROLES as [Role, ...Role[]], { message: 'Choose a role' }),
})
type NewIn = z.input<typeof newSchema>
type NewOut = z.output<typeof newSchema>

function EnableAccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const create = useCreateProfile()
  const form = useForm<NewIn, unknown, NewOut>({
    resolver: zodResolver(newSchema),
    defaultValues: { id: '', full_name: '', phone: '', role: 'dispatcher' },
  })
  useEffect(() => {
    if (open) form.reset({ id: '', full_name: '', phone: '', role: 'dispatcher' })
  }, [open, form])

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await create.mutateAsync(v)
      toast.success(`${v.full_name} can now sign in as ${ROLE_LABEL[v.role]}.`)
      onClose()
    } catch (err) {
      const e = err as { code?: string }
      if (e.code === '23503') toast.error('No sign-in account has that UID. Create the user in Supabase Auth first.')
      else if (e.code === '23505') toast.error('That user already has access. Find them in the list.')
      else toast.error(err, 'Could not enable access.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enable access for a user"
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" form="enable-form" block className="md:w-auto" loading={create.isPending} icon={<ShieldCheck size={20} strokeWidth={1.5} aria-hidden />}>
            Enable access
          </Button>
          <Button variant="secondary" block className="md:w-auto" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="enable-form" noValidate onSubmit={onSubmit}>
        <ol className="mb-4 flex list-decimal flex-col gap-1 pl-6 text-small text-ink-2">
          <li>In Supabase, open Authentication → Users → Add user, and create their email and password.</li>
          <li>Copy the new user's UID and paste it below.</li>
        </ol>
        <FormGrid>
          <TextField form={form} name="id" label="User UID" required autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <TextField form={form} name="full_name" label="Full name" required />
          <TextField form={form} name="phone" label="Phone" type="tel" inputMode="tel" />
          <SelectField form={form} name="role" label="Role" required options={roleOptions} />
        </FormGrid>
      </form>
    </Modal>
  )
}

const editSchema = z.object({
  full_name: requiredText('Full name', 120),
  phone: optionalPhone('Phone'),
  role: z.enum(ROLES as [Role, ...Role[]], { message: 'Choose a role' }).optional(),
})
type EditIn = z.input<typeof editSchema>
type EditOut = z.output<typeof editSchema>

function EditUserModal({ user, isSelf, onClose }: { user: Profile | null; isSelf: boolean; onClose: () => void }) {
  const toast = useToast()
  const update = useUpdateProfile()
  const form = useForm<EditIn, unknown, EditOut>({ resolver: zodResolver(editSchema) })
  useEffect(() => {
    if (user) form.reset({ full_name: user.full_name, phone: user.phone ?? '', role: user.role as Role })
  }, [user, form])

  const onSubmit = form.handleSubmit(async (v) => {
    if (!user) return
    try {
      // Your own role is never sent: an admin cannot demote themselves here.
      const patch = isSelf ? { full_name: v.full_name, phone: v.phone } : v
      await update.mutateAsync({ id: user.id, patch })
      toast.success(`${v.full_name} saved.`)
      onClose()
    } catch (err) {
      toast.error(err, 'Could not save the user.')
    }
  })

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={user ? `Edit ${user.full_name}` : 'Edit user'}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" form="user-form" block className="md:w-auto" loading={update.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            Save user
          </Button>
          <Button variant="secondary" block className="md:w-auto" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="user-form" noValidate onSubmit={onSubmit}>
        <FormGrid>
          <TextField form={form} name="full_name" label="Full name" required />
          <TextField form={form} name="phone" label="Phone" type="tel" inputMode="tel" />
          {isSelf ? (
            <div className="flex flex-col gap-1">
              <p className="micro-label">Role</p>
              <p className="text-body font-semibold">{user ? ROLE_LABEL[user.role as Role] : ''}</p>
              <p className="text-small text-ink-3">You cannot change your own role. Ask another admin.</p>
            </div>
          ) : (
            <SelectField
              form={form}
              name="role"
              label="Role"
              required
              options={roleOptions}
              hint="Takes effect the next time they open the app."
            />
          )}
        </FormGrid>
      </form>
    </Modal>
  )
}

export function UsersPage() {
  const me = useProfile()
  const toast = useToast()
  const q = useProfiles()
  const update = useUpdateProfile()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'all' | Role>('all')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [toggling, setToggling] = useState<Profile | null>(null)

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return q.data?.filter(
      (p) => (role === 'all' || p.role === role) && (!s || p.full_name.toLowerCase().includes(s) || (p.phone ?? '').includes(s)),
    )
  }, [q.data, search, role])

  const addButton = (
    <Button icon={<UserPlus size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setAdding(true)}>
      Enable access
    </Button>
  )

  const actions = (p: Profile) => (
    <div className="flex flex-col gap-2 md:flex-row md:justify-end">
      <Button variant="secondary" block className="md:h-row md:min-h-row md:w-auto" onClick={() => setEditing(p)}>
        Edit
      </Button>
      {p.id !== me.id && (
        <Button variant="ghost" block className="md:h-row md:min-h-row md:w-auto" onClick={() => setToggling(p)}>
          {p.is_active ? 'Deactivate' : 'Reactivate'}
        </Button>
      )}
    </div>
  )

  const filtered = Boolean(search) || role !== 'all'

  return (
    <>
      <PageHeader title="Users" action={addButton} />
      <div className="mb-4 flex flex-col gap-3">
        <SearchInput label="Search users" value={search} onChange={setSearch} placeholder="Search name or phone" />
        <FilterPills
          label="Role"
          value={role}
          onChange={setRole}
          options={[{ value: 'all' as const, label: 'All roles' }, ...roleOptions.map((r) => ({ value: r.value as Role, label: r.label }))]}
        />
      </div>
      <DataTable
        noun="users"
        caption="Users"
        rows={rows}
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(p) => p.id}
        emptyMessage={filtered ? 'No users match these filters.' : 'No users yet.'}
        emptyAction={filtered ? undefined : addButton}
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (p) => (
              <span className="font-semibold">
                {p.full_name}
                {p.id === me.id && <span className="ml-2 text-small font-normal text-ink-3">(you)</span>}
              </span>
            ),
          },
          { key: 'phone', header: 'Phone', render: (p) => <span className="num">{p.phone ?? '—'}</span> },
          { key: 'role', header: 'Role', render: (p) => <StatusPill tone={p.role === 'admin' ? 'accent' : 'neutral'}>{ROLE_LABEL[p.role as Role] ?? p.role}</StatusPill> },
          { key: 'since', header: 'Added', render: (p) => <span className="num">{formatDateTime(p.created_at)}</span> },
          { key: 'status', header: 'Status', render: (p) => <ActivePill active={p.is_active} /> },
          { key: 'actions', header: 'Actions', align: 'right', render: actions },
        ]}
        mobile={{
          title: (p) => `${p.full_name}${p.id === me.id ? ' (you)' : ''}`,
          lines: (p) => <span className="num">{p.phone ?? 'No phone'}</span>,
          figure: (p) => <StatusPill tone={p.role === 'admin' ? 'accent' : 'neutral'}>{ROLE_LABEL[p.role as Role] ?? p.role}</StatusPill>,
          figureCaption: (p) => <ActivePill active={p.is_active} />,
          actions,
        }}
      />
      <EnableAccessModal open={adding} onClose={() => setAdding(false)} />
      <EditUserModal user={editing} isSelf={editing?.id === me.id} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.is_active ? `Deactivate ${toggling?.full_name}?` : `Reactivate ${toggling?.full_name}?`}
        message={
          toggling?.is_active
            ? 'They are blocked from all data straight away and signed out the next time the app checks their access.'
            : 'They can sign in again with their existing password.'
        }
        confirmLabel={toggling?.is_active ? 'Deactivate user' : 'Reactivate user'}
        tone={toggling?.is_active ? 'danger' : 'primary'}
        loading={update.isPending}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return
          try {
            await update.mutateAsync({ id: toggling.id, patch: { is_active: !toggling.is_active } })
            toast.success(`${toggling.full_name} ${toggling.is_active ? 'deactivated' : 'reactivated'}.`)
            setToggling(null)
          } catch (err) {
            toast.error(err)
          }
        }}
      />
    </>
  )
}
