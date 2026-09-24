import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LocateFixed, Save } from 'lucide-react'
import { Button, FormGrid, Modal, TextField, TextareaField, useToast } from '@/components/ui'
import { useGeolocation } from '@/hooks/useGeolocation'
import { latitude, longitude, optionalText, requiredText, wholeNumber } from '@/lib/zod'
import type { CustomerSite } from '@/services/customerSites'
import { useSaveSite } from './api'

const schema = z
  .object({
    name: requiredText('Site name', 160),
    area: requiredText('Area', 120),
    latitude,
    longitude,
    geofence_radius_m: wholeNumber('Geofence radius', { min: 50, max: 5000 }),
    directions: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if ((v.latitude === null) !== (v.longitude === null)) {
      ctx.addIssue({
        code: 'custom',
        path: [v.latitude === null ? 'latitude' : 'longitude'],
        message: 'Enter both latitude and longitude, or neither',
      })
    }
  })

type In = z.input<typeof schema>
type Out = z.output<typeof schema>

function toForm(s?: CustomerSite | null): In {
  return {
    name: s?.name ?? '',
    area: s?.area ?? '',
    latitude: s?.latitude != null ? String(s.latitude) : '',
    longitude: s?.longitude != null ? String(s.longitude) : '',
    geofence_radius_m: String(s?.geofence_radius_m ?? 300),
    directions: s?.directions ?? '',
  }
}

export function SiteFormModal({
  open,
  onClose,
  customerId,
  site,
}: {
  open: boolean
  onClose: () => void
  customerId: string
  site?: CustomerSite | null
}) {
  const toast = useToast()
  const save = useSaveSite(customerId)
  const geo = useGeolocation()
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(schema), defaultValues: toForm(site) })

  useEffect(() => {
    if (open) form.reset(toForm(site))
  }, [open, site, form])

  const useMyLocation = async () => {
    const pos = await geo.locate()
    if (!pos) return
    form.setValue('latitude', String(pos.latitude), { shouldValidate: true, shouldDirty: true })
    form.setValue('longitude', String(pos.longitude), { shouldValidate: true, shouldDirty: true })
    toast.info(`Location captured, accurate to about ${pos.accuracy} m.`)
  }

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: site?.id, input: site ? v : { ...v, customer_id: customerId } })
      toast.success(site ? 'Site saved.' : `Site ${v.name} added.`)
      onClose()
    } catch (err) {
      toast.error(err, 'Could not save the site.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={site ? `Edit site: ${site.name}` : 'Add delivery site'}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" form="site-form" block className="md:w-auto" loading={save.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            {site ? 'Save site' : 'Add site'}
          </Button>
          <Button variant="secondary" block className="md:w-auto" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="site-form" noValidate onSubmit={onSubmit}>
        <FormGrid>
          <TextField form={form} name="name" label="Site name" required hint="e.g. Block C, Gwarinpa 3rd Avenue" />
          <TextField form={form} name="area" label="Area" required hint="District used to match a route, e.g. Gwarinpa" />
          <div className="flex flex-col gap-3 rounded border border-line bg-surface-2 p-3">
            <p className="micro-label">Coordinates</p>
            <Button variant="secondary" block loading={geo.loading} onClick={useMyLocation} icon={<LocateFixed size={20} strokeWidth={1.5} aria-hidden />}>
              Use my current location
            </Button>
            {geo.error && (
              <p role="alert" className="text-small font-medium text-danger">
                {geo.error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <TextField form={form} name="latitude" label="Latitude" inputMode="decimal" placeholder="9.0765" />
              <TextField form={form} name="longitude" label="Longitude" inputMode="decimal" placeholder="7.3986" />
            </div>
          </div>
          <TextField
            form={form}
            name="geofence_radius_m"
            label="Geofence radius (metres)"
            inputMode="numeric"
            required
            hint="Deliveries are expected inside this radius. Default 300 m."
          />
          <TextareaField form={form} name="directions" label="Directions for drivers" />
        </FormGrid>
      </form>
    </Modal>
  )
}
