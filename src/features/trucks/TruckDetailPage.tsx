import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Camera, ImageOff, Pencil, RotateCw } from 'lucide-react'
import {
  Button,
  ButtonLink,
  Card,
  ErrorState,
  Facts,
  PageHeader,
  Section,
  SkeletonBlock,
  useToast,
} from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { formatDateTime, formatNumber } from '@/lib/format'
import { toJpeg } from '@/lib/image'
import { useTruck, useTruckPhotoUrl, useUploadTruckPhoto } from './api'
import { ownerLabel, TruckStatusPill } from './labels'

export function TruckDetailPage() {
  const { id = '' } = useParams()
  const { canWriteMasterData } = useRole()
  const q = useTruck(id)

  if (q.isLoading) {
    return (
      <>
        <PageHeader title={<SkeletonBlock className="h-8 w-[180px]" />} back={{ to: '/trucks', label: 'Trucks' }} />
        <SkeletonBlock className="h-[160px] w-full" />
      </>
    )
  }
  if (q.isError || !q.data) {
    return (
      <>
        <PageHeader title="Truck" back={{ to: '/trucks', label: 'Trucks' }} />
        <ErrorState what="Could not load this truck." error={q.error} onRetry={() => void q.refetch()} />
      </>
    )
  }
  const t = q.data

  return (
    <>
      <PageHeader
        title={<span className="num">{t.plate_number}</span>}
        back={{ to: '/trucks', label: 'Trucks' }}
        meta={<TruckStatusPill status={t.is_active ? t.status : 'inactive'} />}
        action={
          canWriteMasterData && (
            <ButtonLink to={`/trucks/${t.id}/edit`} variant="secondary" icon={<Pencil size={20} strokeWidth={1.5} aria-hidden />}>
              Edit
            </ButtonLink>
          )
        }
      />
      <Card emphasis>
        <Facts
          items={[
            { label: 'Make / model', value: [t.make, t.model].filter(Boolean).join(' ') || '—' },
            { label: 'Capacity', value: t.capacity_tons != null ? formatNumber(Number(t.capacity_tons), 'tonnes') : '—', numeric: true },
            { label: 'Owner type', value: ownerLabel(t.owner_type) },
            { label: 'Owner name', value: t.owner_name || '—' },
            { label: 'Added', value: formatDateTime(t.created_at), numeric: true },
            { label: 'Last changed', value: formatDateTime(t.updated_at ?? t.created_at), numeric: true },
          ]}
        />
      </Card>
      <ReferencePhoto truckId={t.id} plate={t.plate_number} path={t.reference_load_photo_url} version={t.updated_at} canWrite={canWriteMasterData} />
    </>
  )
}

function ReferencePhoto({
  truckId,
  plate,
  path,
  version,
  canWrite,
}: {
  truckId: string
  plate: string
  path: string | null
  version: string | null
  canWrite: boolean
}) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const photo = useTruckPhotoUrl(path, version)
  const upload = useUploadTruckPhoto()
  const [processing, setProcessing] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setProcessing(true)
    try {
      const jpeg = await toJpeg(file)
      await upload.mutateAsync({ truckId, jpeg })
      toast.success(`Reference photo saved for ${plate}.`)
    } catch (err) {
      toast.error(err, 'Could not upload the photo.')
    } finally {
      setProcessing(false)
      if (input.current) input.current.value = ''
    }
  }

  const busy = processing || upload.isPending
  const action = canWrite ? (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Reference photo file"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button variant={path ? 'secondary' : 'primary'} loading={busy} icon={<Camera size={20} strokeWidth={1.5} aria-hidden />} onClick={() => input.current?.click()}>
        {path ? 'Replace photo' : 'Add photo'}
      </Button>
    </>
  ) : undefined

  return (
    <Section title="Reference full-load photo" action={action}>
      <p className="mb-3 text-small text-ink-2">
        What a full load looks like on this truck. Loading photos on every trip are compared against it.
      </p>
      {!path ? (
        <div className="flex min-h-[160px] flex-col items-start justify-center gap-3 rounded-panel border border-dashed border-line bg-panel p-4">
          <ImageOff size={20} strokeWidth={1.5} className="text-ink-3" aria-hidden />
          <p className="text-body text-ink-2">No reference photo yet.</p>
        </div>
      ) : photo.isError ? (
        <div className="flex flex-col items-start gap-3 rounded-panel border border-line border-l-2 border-l-danger bg-panel p-4" role="alert">
          <p className="font-semibold">Could not load the photo.</p>
          <Button variant="secondary" icon={<RotateCw size={20} strokeWidth={1.5} aria-hidden />} onClick={() => void photo.refetch()}>
            Retry
          </Button>
        </div>
      ) : photo.isLoading || !photo.data ? (
        <SkeletonBlock className="aspect-[4/3] w-full max-w-[640px]" />
      ) : (
        <a href={photo.data} target="_blank" rel="noreferrer" className="block max-w-[640px]">
          <img
            src={photo.data}
            alt={`Full load reference for truck ${plate}`}
            className="aspect-[4/3] w-full rounded-panel border border-line bg-surface-2 object-cover"
            loading="lazy"
          />
        </a>
      )}
    </Section>
  )
}
