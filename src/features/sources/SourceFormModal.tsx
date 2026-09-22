import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LocateFixed, Save } from 'lucide-react'
import { Button, FormGrid, Modal, NairaField, SelectField, TextField, useToast } from '@/components/ui'
import { useGeolocation } from '@/hooks/useGeolocation'
import { latitude, longitude, naira, optionalText, requiredText } from '@/lib/zod'
import { MATERIALS, type MaterialSource } from '@/services/materialSources'
import { useSaveSource } from './api'
import { MATERIAL_LABEL } from './labels'

const schema = z
  .object({
    name: requiredText('Name', 160),
    material: z.enum(MATERIALS as [string, ...string[]], { message: 'Choose a material' }),
    area: optionalText(120),
    latitude,
    longitude,
    default_material_cost: naira('Default material cost'),
  })
  .superRefine((v, ctx) => {
    if ((v.latitude === null) !== (v.longitude === null)) {
      ctx.addIssue({ code: 'custom', path: [v.latitude === null ? 'latitude' : 'longitude'], message: 'Enter both latitude and longitude, or neither' })
    }
  })
type In = z.input<typeof schema>
type Out = z.output<typeof schema>

const toForm = (s?: MaterialSource | null): In => ({
  name: s?.name ?? '',
  material: s?.material ?? 'sharp_sand',
  area: s?.area ?? '',
  latitude: s?.latitude != null ? String(s.latitude) : '',
  longitude: s?.longitude != null ? String(s.longitude) : '',
  default_material_cost: String(s?.default_material_cost ?? 0),
})

export function SourceFormModal({ open, onClose, source }: { open: boolean; onClose: () => void; source?: MaterialSource | null }) {
  const toast = useToast()
  const save = useSaveSource()
  const geo = useGeolocation()
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(schema), defaultValues: toForm(source) })

  useEffect(() => {
    if (open) form.reset(toForm(source))
  }, [open, source, form])

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: source?.id, input: v })
      toast.success(source ? 'Source saved.' : `Source ${v.name} added.`)
      onClose()
    } catch (err) {
      toast.error(err, 'Could not save the source.')
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={source ? `Edit ${source.name}` : 'New material source'}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" form="source-form" block className="md:w-auto" loading={save.isPending} icon={<Save size={20} strokeWidth={1.5} aria-hidden />}>
            {source ? 'Save source' : 'Add source'}
          </Button>
          <Button variant="secondary" block className="md:w-auto" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="source-form" noValidate onSubmit={onSubmit}>
        <FormGrid>
          <TextField form={form} name="name" label="Name" required hint="e.g. Koita sand site" />
          <SelectField
            form={form}
            name="material"
            label="Material"
            required
            options={MATERIALS.map((m) => ({ value: m, label: MATERIAL_LABEL[m] }))}
          />
          <TextField form={form} name="area" label="Area" />
          <NairaField form={form} name="default_material_cost" label="Default material cost per load" required />
          <div className="flex flex-col gap-3 rounded border border-line bg-surface-2 p-3">
            <p className="micro-label">Coordinates</p>
            <Button
              variant="secondary"
              block
              loading={geo.loading}
              icon={<LocateFixed size={20} strokeWidth={1.5} aria-hidden />}
              onClick={async () => {
                const pos = await geo.locate()
                if (!pos) return
                form.setValue('latitude', String(pos.latitude), { shouldValidate: true })
                form.setValue('longitude', String(pos.longitude), { shouldValidate: true })
                toast.info(`Location captured, accurate to about ${pos.accuracy} m.`)
              }}
            >
              Use my current location
            </Button>
            {geo.error && (
              <p role="alert" className="text-small font-medium text-danger">
                {geo.error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <TextField form={form} name="latitude" label="Latitude" inputMode="decimal" />
              <TextField form={form} name="longitude" label="Longitude" inputMode="decimal" />
            </div>
          </div>
        </FormGrid>
      </form>
    </Modal>
  )
}
