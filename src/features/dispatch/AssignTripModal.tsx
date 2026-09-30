import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Send } from 'lucide-react'
import { Button, FormGrid, Modal, SelectField, useToast } from '@/components/ui'
import { ACTIVE_TRIP_STATUSES, type TripStatus } from '@/services/trips'
import { useDrivers } from '@/features/drivers/api'
import { useTrucks, useTruckPhotoUrl } from '@/features/trucks/api'
import { useAssignTrip, useDispatchTrips } from '@/features/orders/api'

const schema = z.object({
  driver_id: z.string().uuid('Choose a driver'),
  truck_id: z.string().uuid('Choose a truck'),
})
type Form = z.infer<typeof schema>

export type AssignableTrip = {
  id: string
  trip_number: string
  driver_id: string | null
  truck_id: string | null
  /** "Customer · site" line shown under the title. */
  where?: string
}

export function AssignTripModal({ trip, onClose }: { trip: AssignableTrip | null; onClose: () => void }) {
  const toast = useToast()
  const assign = useAssignTrip()
  const drivers = useDrivers({ active: 'active' })
  const trucks = useTrucks({ active: 'active' })
  const board = useDispatchTrips()
  const open = Boolean(trip)

  // Drivers and trucks already on another active trip.
  const busy = useMemo(() => {
    const d = new Set<string>()
    const t = new Set<string>()
    for (const x of board.data ?? []) {
      if (x.id === trip?.id || !ACTIVE_TRIP_STATUSES.includes(x.status as TripStatus)) continue
      if (x.driver_id) d.add(x.driver_id)
      if (x.truck_id) t.add(x.truck_id)
    }
    return { d, t }
  }, [board.data, trip?.id])

  const freeDrivers = (drivers.data ?? []).filter((d) => !busy.d.has(d.id))
  const freeTrucks = (trucks.data ?? []).filter(
    (t) => !busy.t.has(t.id) && (t.status === 'available' || t.status === 'on_trip' || t.id === trip?.truck_id),
  )

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { driver_id: '', truck_id: '' } })
  useEffect(() => {
    if (open) form.reset({ driver_id: trip?.driver_id ?? '', truck_id: trip?.truck_id ?? '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trip?.id])

  const driverId = form.watch('driver_id')
  const truckId = form.watch('truck_id')
  const driver = freeDrivers.find((d) => d.id === driverId)
  const usual = driver?.truck
  const usualFree = usual ? freeTrucks.some((t) => t.id === usual.id) : false

  // Picking a driver fills in their usual truck when it is free.
  useEffect(() => {
    if (!driverId || !form.getFieldState('driver_id').isDirty) return
    form.setValue('truck_id', usual && usualFree ? usual.id : '', { shouldValidate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId])

  const truck = freeTrucks.find((t) => t.id === truckId)
  const photo = useTruckPhotoUrl(truck?.reference_load_photo_url, truck?.updated_at)

  let truckHint: string | undefined
  if (driver && !usual) truckHint = `${driver.full_name} has no usual truck. Choose one.`
  else if (driver && usual && !usualFree) truckHint = `Their usual truck ${usual.plate_number} is not free. Choose another.`
  else if (driver && usual && truckId && truckId !== usual.id) truckHint = `Not their usual truck (${usual.plate_number}).`

  const onSubmit = form.handleSubmit(async (v) => {
    if (!trip) return
    try {
      await assign.mutateAsync({ tripId: trip.id, driverId: v.driver_id, truckId: v.truck_id })
      const d = freeDrivers.find((x) => x.id === v.driver_id)
      const t = freeTrucks.find((x) => x.id === v.truck_id)
      toast.success(`${trip.trip_number} dispatched to ${d?.full_name ?? 'driver'}, truck ${t?.plate_number ?? ''}.`)
      onClose()
    } catch (err) {
      toast.error(err, 'Could not dispatch the trip.')
    }
  })

  const loading = drivers.isLoading || trucks.isLoading || board.isLoading
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={trip?.driver_id ? `Reassign ${trip.trip_number}` : `Dispatch ${trip?.trip_number ?? ''}`}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" form="assign-form" block className="md:w-auto" loading={assign.isPending} icon={<Send size={20} strokeWidth={1.5} aria-hidden />}>
            {trip?.driver_id ? 'Reassign trip' : 'Dispatch trip'}
          </Button>
          <Button variant="secondary" block className="md:w-auto" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="assign-form" noValidate onSubmit={onSubmit}>
        {trip?.where && <p className="mb-4 text-small text-ink-2">{trip.where}</p>}
        <FormGrid>
          <SelectField
            form={form}
            name="driver_id"
            label="Driver"
            required
            placeholder={loading ? 'Loading drivers…' : freeDrivers.length ? 'Choose a driver' : 'No free drivers'}
            options={freeDrivers.map((d) => ({ value: d.id, label: d.truck ? `${d.full_name} · ${d.truck.plate_number}` : d.full_name }))}
            hint={!loading && freeDrivers.length === 0 ? 'Every active driver is on a trip.' : undefined}
          />
          <SelectField
            form={form}
            name="truck_id"
            label="Truck"
            required
            placeholder={loading ? 'Loading trucks…' : freeTrucks.length ? 'Choose a truck' : 'No free trucks'}
            options={freeTrucks.map((t) => ({ value: t.id, label: t.plate_number }))}
            hint={truckHint ?? 'Trucks in maintenance or already on a trip are not listed.'}
          />
        </FormGrid>
        {truck?.reference_load_photo_url && (
          <figure className="mt-4">
            <figcaption className="micro-label mb-1">Reference full load · {truck.plate_number}</figcaption>
            {photo.data ? (
              <img src={photo.data} alt={`Reference full load for ${truck.plate_number}`} className="h-[140px] w-full rounded border border-line object-cover" />
            ) : (
              <div className="skeleton h-[140px] w-full" aria-hidden />
            )}
          </figure>
        )}
      </form>
    </Modal>
  )
}
