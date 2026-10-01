import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, MapPin, MapPinOff, RotateCw, X } from 'lucide-react'
import { Button, Field, Input, Modal, useToast } from '@/components/ui'
import { useGeolocation, type Position } from '@/hooks/useGeolocation'
import { distanceM, insideSite } from '@/lib/geo'
import { toJpeg } from '@/lib/image'
import type { MyTrip, PhotoType, TripStep } from '@/services/trips'
import { useRecordTripStep, useUploadTripPhoto } from '@/features/orders/api'
import { PhotoThumb } from '@/features/orders/TripProgress'

const TITLE: Record<TripStep, string> = {
  loaded: "I've loaded",
  in_transit: "I've left the loading site",
  delivered: "I've delivered",
}
const CONFIRM: Record<TripStep, string> = { loaded: 'Confirm loaded', in_transit: 'Confirm left site', delivered: 'Confirm delivered' }
const DONE: Record<TripStep, string> = { loaded: 'Loading recorded.', in_transit: 'On the way. Drive safely.', delivered: 'Delivery recorded. Well done.' }

/** One step for the driver: optional photo, location, then one big confirm. */
export function DriverStepSheet({ trip, step, onClose }: { trip: MyTrip; step: TripStep; onClose: () => void }) {
  const toast = useToast()
  const record = useRecordTripStep()
  const upload = useUploadTripPhoto()
  const geo = useGeolocation()
  const [pos, setPos] = useState<Position | null>(null)
  const [receipt, setReceipt] = useState('')
  const [photo, setPhoto] = useState<{ jpeg: Blob; url: string } | null>(null)
  const [photoSent, setPhotoSent] = useState(false)
  const [processing, setProcessing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoType: PhotoType | null = step === 'loaded' ? 'loading' : step === 'delivered' ? 'delivery' : null
  const { locate } = geo

  // Location is taken as soon as the sheet opens: needed for delivery, useful evidence for loading.
  useEffect(() => {
    if (step === 'in_transit') return
    void locate().then(setPos)
  }, [step, locate])

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url)
  }, [photo])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setProcessing(true)
    try {
      const jpeg = await toJpeg(file)
      setPhoto({ jpeg, url: URL.createObjectURL(jpeg) })
      setPhotoSent(false)
    } catch (err) {
      toast.error(err, 'Could not use that photo.')
    } finally {
      setProcessing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirm = async () => {
    let photoFailed = false
    if (photo && photoType && !photoSent) {
      try {
        await upload.mutateAsync({ tripId: trip.trip_id, type: photoType, jpeg: photo.jpeg, position: pos })
        setPhotoSent(true)
      } catch {
        photoFailed = true
      }
    }
    try {
      await record.mutateAsync({ tripId: trip.trip_id, step, position: pos, receipt: step === 'loaded' ? receipt : undefined })
      if (photoFailed) toast.error('Step recorded, but the photo was not sent. Tell the office.')
      else toast.success(DONE[step])
      onClose()
    } catch (err) {
      toast.error(err, 'Not sent. Check your data and tap again.')
    }
  }

  const busy = record.isPending || upload.isPending
  const waitingForGps = step === 'delivered' && geo.loading

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      title={TITLE[step]}
      footer={
        <Button block loading={busy} disabled={processing || waitingForGps} icon={<CheckCircle2 size={20} strokeWidth={1.5} aria-hidden />} onClick={() => void confirm()}>
          {waitingForGps ? 'Getting your location…' : CONFIRM[step]}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink-2">
          <span className="num font-semibold text-ink">{trip.trip_number}</span> · {trip.site_name}, {trip.site_area}
        </p>

        {step === 'loaded' && (
          <PhotoThumb
            large
            path={trip.truck_reference_photo}
            alt={`Full load reference for truck ${trip.truck_plate ?? ''}`}
            caption={trip.truck_reference_photo ? 'A full load on this truck looks like this. Take your photo the same way.' : 'No reference photo for this truck yet.'}
          />
        )}

        {step === 'in_transit' && <p className="text-body">Confirm you have left the loading site with the full load.</p>}

        {photoType && (
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label={`${photoType === 'loading' ? 'Loading' : 'Delivery'} photo file`}
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {photo ? (
              <div className="flex items-start gap-3">
                <img src={photo.url} alt="Your photo" className="h-[96px] w-[128px] rounded-panel border border-line object-cover" />
                <div className="flex flex-col gap-2">
                  <Button variant="secondary" icon={<RotateCw size={20} strokeWidth={1.5} aria-hidden />} onClick={() => fileRef.current?.click()} disabled={busy}>
                    Retake
                  </Button>
                  <Button variant="ghost" icon={<X size={20} strokeWidth={1.5} aria-hidden />} onClick={() => setPhoto(null)} disabled={busy}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" block loading={processing} icon={<Camera size={20} strokeWidth={1.5} aria-hidden />} onClick={() => fileRef.current?.click()}>
                Take {photoType === 'loading' ? 'loading' : 'delivery'} photo
              </Button>
            )}
            <p className="text-small text-ink-3">Optional, but it protects you if the customer complains.</p>
          </div>
        )}

        {step === 'loaded' && (
          <Field label="Loader receipt no." hint="Optional">
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} value={receipt} maxLength={40} onChange={(e) => setReceipt(e.target.value)} />}
          </Field>
        )}

        {step === 'delivered' && <LocationStatus trip={trip} pos={pos} loading={geo.loading} error={geo.error} onRetry={() => void locate().then(setPos)} />}
      </div>
    </Modal>
  )
}

function LocationStatus({
  trip,
  pos,
  loading,
  error,
  onRetry,
}: {
  trip: MyTrip
  pos: Position | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const box = 'flex items-start gap-2 rounded-panel border border-line bg-panel p-3 border-l-2'
  if (loading) {
    return (
      <div className={`${box} border-l-info`} role="status">
        <MapPin size={20} strokeWidth={1.5} className="mt-px shrink-0" aria-hidden />
        <p>Getting your location…</p>
      </div>
    )
  }
  if (!pos) {
    return (
      <div className={`${box} border-l-warn flex-col`} role="status">
        <p className="flex items-start gap-2 font-semibold">
          <MapPinOff size={20} strokeWidth={1.5} className="mt-px shrink-0 text-warn" aria-hidden />
          Location off
        </p>
        <p className="text-small text-ink-2">{error ?? 'Your location is not available.'} You can still confirm; the office will see “No location”.</p>
        <Button variant="secondary" icon={<RotateCw size={20} strokeWidth={1.5} aria-hidden />} onClick={onRetry}>
          Try location again
        </Button>
      </div>
    )
  }
  if (trip.site_latitude == null || trip.site_longitude == null) {
    return (
      <div className={`${box} border-l-info`} role="status">
        <MapPin size={20} strokeWidth={1.5} className="mt-px shrink-0" aria-hidden />
        <p>This site has no map pin yet. Your location is sent to the office.</p>
      </div>
    )
  }
  const d = distanceM(pos.latitude, pos.longitude, Number(trip.site_latitude), Number(trip.site_longitude))
  const inside = insideSite(d, trip.site_geofence_m, pos.accuracy)
  return inside ? (
    <div className={`${box} border-l-ok`} role="status">
      <CheckCircle2 size={20} strokeWidth={1.5} className="mt-px shrink-0 text-ok" aria-hidden />
      <p className="font-semibold">You are at the site.</p>
    </div>
  ) : (
    <div className={`${box} border-l-warn flex-col`} role="status">
      <p className="flex items-start gap-2 font-semibold">
        <MapPin size={20} strokeWidth={1.5} className="mt-px shrink-0 text-warn" aria-hidden />
        <span>
          <span className="num">{d.toLocaleString('en-NG')}m</span> from the site
        </span>
      </p>
      <p className="text-small text-ink-2">If you are at the right place, confirm anyway. The office will see the distance.</p>
      <Button variant="secondary" icon={<RotateCw size={20} strokeWidth={1.5} aria-hidden />} onClick={onRetry}>
        Check location again
      </Button>
    </div>
  )
}
