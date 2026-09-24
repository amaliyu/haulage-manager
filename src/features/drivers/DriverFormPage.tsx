import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Power, Save } from 'lucide-react'
import {
  ActivePill,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  ErrorState,
  FormActions,
  FormGrid,
  PageHeader,
  SelectField,
  SkeletonBlock,
  TextField,
  useToast,
} from '@/components/ui'
import { optionalText, phone, requiredText } from '@/lib/zod'
import type { DriverWithTruck } from '@/services/drivers'
import { useTrucks } from '@/features/trucks/api'
import { useProfiles } from '@/features/users/api'
import { useDriver, useDrivers, useSaveDriver } from './api'

const schema = z.object({
  full_name: requiredText('Full name', 120),
  phone: phone('Phone'),
  licence_number: optionalText(40),
  assigned_truck_id: z.string().transform((v) => (v === '' ? null : v)),
  profile_id: z.string().transform((v) => (v === '' ? null : v)),
})
type In = z.input<typeof schema>
type Out = z.output<typeof schema>

export function DriverFormPage() {
  const { id } = useParams()
  const q = useDriver(id)
  if (id && q.isLoading) {
    return (
      <>
        <PageHeader title="Edit driver" back={{ to: '/drivers', label: 'Drivers' }} />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonBlock key={i} className="h-input w-full" />
          ))}
        </div>
      </>
    )
  }
  if (id && (q.isError || !q.data)) return <ErrorState what="Could not load this driver." error={q.error} onRetry={() => void q.refetch()} />
  return <DriverForm driver={q.data} />
}

function DriverForm({ driver }: { driver?: DriverWithTruck }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveDriver()
  const trucks = useTrucks({ active: 'active' })
  const drivers = useDrivers({ active: 'all' })
  const profiles = useProfiles()
  const [toggling, setToggling] = useState(false)

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: driver?.full_name ?? '',
      phone: driver?.phone ?? '',
      licence_number: driver?.licence_number ?? '',
      assigned_truck_id: driver?.assigned_truck_id ?? '',
      profile_id: driver?.profile_id ?? '',
    },
  })

  const truckOptions = useMemo(() => {
    const takenBy = new Map<string, string>()
    for (const d of drivers.data ?? []) if (d.assigned_truck_id && d.id !== driver?.id && d.is_active) takenBy.set(d.assigned_truck_id, d.full_name)
    const opts = (trucks.data ?? []).map((t) => ({
      value: t.id,
      label: takenBy.has(t.id) ? `${t.plate_number} (with ${takenBy.get(t.id)})` : t.plate_number,
    }))
    if (driver?.truck && !opts.some((o) => o.value === driver.truck!.id)) opts.push({ value: driver.truck.id, label: `${driver.truck.plate_number} (inactive)` })
    return opts
  }, [trucks.data, drivers.data, driver])

  // Only driver-role users, not already linked to another driver row.
  const profileOptions = useMemo(() => {
    const linked = new Set((drivers.data ?? []).filter((d) => d.id !== driver?.id && d.profile_id).map((d) => d.profile_id))
    return (profiles.data ?? [])
      .filter((p) => p.role === 'driver' && (!linked.has(p.id) || p.id === driver?.profile_id))
      .map((p) => ({ value: p.id, label: `${p.full_name}${p.is_active ? '' : ' (inactive)'}` }))
  }, [profiles.data, drivers.data, driver])

  const truckId = form.watch('assigned_truck_id')
  const clash = (drivers.data ?? []).find((d) => d.assigned_truck_id === truckId && truckId && d.id !== driver?.id && d.is_active)

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: driver?.id, input: v })
      toast.success(driver ? 'Driver saved.' : `Driver ${v.full_name} added.`)
      navigate('/drivers', { replace: true })
    } catch (err) {
      toast.error(err, 'Could not save the driver.')
    }
  })

  return (
    <>
      <PageHeader
        title={driver ? `Edit ${driver.full_name}` : 'New driver'}
        back={{ to: '/drivers', label: 'Drivers' }}
        meta={driver && <ActivePill active={driver.is_active} />}
      />
      <form noValidate onSubmit={onSubmit} className="flex max-w-[720px] flex-col gap-4">
        <Card title="Driver">
          <FormGrid cols={2}>
            <TextField form={form} name="full_name" label="Full name" required autoComplete="name" className="md:col-span-2" />
            <TextField form={form} name="phone" label="Phone" required type="tel" inputMode="tel" autoComplete="tel" />
            <TextField form={form} name="licence_number" label="Licence number" autoCapitalize="characters" />
          </FormGrid>
        </Card>
        <Card title="Truck and app login">
          <FormGrid>
            <SelectField
              form={form}
              name="assigned_truck_id"
              label="Assigned truck"
              placeholder={trucks.isLoading ? 'Loading trucks…' : 'No truck'}
              options={truckOptions}
              hint={
                trucks.isError
                  ? 'Could not load trucks. Reload the page.'
                  : clash
                    ? `${clash.full_name} is also assigned to this truck.`
                    : undefined
              }
            />
            <SelectField
              form={form}
              name="profile_id"
              label="App login (user)"
              placeholder={profiles.isLoading ? 'Loading users…' : 'Not linked'}
              options={profileOptions}
              hint={
                profiles.isError
                  ? 'Could not load users. Reload the page.'
                  : 'Link a user with the Driver role so this driver can sign in. Add users from the Users screen.'
              }
            />
          </FormGrid>
        </Card>
        {driver && (
          <Card>
            <Button
              variant={driver.is_active ? 'secondary' : 'primary'}
              block
              className="md:w-auto"
              icon={<Power size={20} strokeWidth={1.5} aria-hidden />}
              onClick={() => setToggling(true)}
            >
              {driver.is_active ? 'Deactivate driver' : 'Reactivate driver'}
            </Button>
          </Card>
        )}
        <FormActions>
          <Button type="submit" block className="md:w-auto" loading={save.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            {driver ? 'Save driver' : 'Add driver'}
          </Button>
          <ButtonLink to="/drivers" variant="secondary" block className="md:w-auto">
            Cancel
          </ButtonLink>
        </FormActions>
      </form>
      {driver && (
        <ConfirmDialog
          open={toggling}
          title={driver.is_active ? `Deactivate ${driver.full_name}?` : `Reactivate ${driver.full_name}?`}
          message={
            driver.is_active
              ? 'They cannot be assigned trips and lose access to their trips in the app. Their history is kept.'
              : 'They can be assigned trips again.'
          }
          confirmLabel={driver.is_active ? 'Deactivate driver' : 'Reactivate driver'}
          tone={driver.is_active ? 'danger' : 'primary'}
          loading={save.isPending}
          onClose={() => setToggling(false)}
          onConfirm={async () => {
            try {
              await save.mutateAsync({ id: driver.id, input: { is_active: !driver.is_active } })
              toast.success(`${driver.full_name} ${driver.is_active ? 'deactivated' : 'reactivated'}.`)
              setToggling(false)
              navigate('/drivers', { replace: true })
            } catch (err) {
              toast.error(err)
            }
          }}
        />
      )}
    </>
  )
}
