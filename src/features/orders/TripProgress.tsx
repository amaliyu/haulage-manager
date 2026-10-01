import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { Button, Field, Input, Modal, SkeletonBlock, StatusPill, Textarea, useToast } from '@/components/ui'
import { cn } from '@/components/ui/cn'
import { nextStep, type BreakdownLoad, type Trip, type TripFlag, type TripStep } from '@/services/trips'
import { useTruckPhotoUrl } from '@/features/trucks/api'
import { useRecordTripStep, useReportBreakdown } from './api'

export const STEP_LABEL: Record<TripStep, string> = { loaded: 'Loaded', in_transit: 'In transit', delivered: 'Delivered' }

export function TripFlagPills({ flags, className }: { flags: TripFlag[]; className?: string }) {
  if (!flags.length) return null
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {flags.map((f) => (
        <StatusPill key={f.label} tone={f.tone}>
          {f.label}
        </StatusPill>
      ))}
    </span>
  )
}

/** A private trip or truck photo, opened full size on tap. */
export function PhotoThumb({ path, alt, caption, large }: { path: string | null | undefined; alt: string; caption: string; large?: boolean }) {
  const q = useTruckPhotoUrl(path)
  const box = large ? 'aspect-[4/3] w-full' : 'h-[96px] w-[128px]'
  return (
    <figure className={cn('flex flex-col gap-1', large && 'w-full')}>
      {!path ? (
        <div className={cn(box, 'flex items-center justify-center rounded-panel border border-dashed border-line bg-surface-2 text-ink-3')}>
          <ImageOff size={20} strokeWidth={1.5} aria-hidden />
        </div>
      ) : q.isError ? (
        <button type="button" onClick={() => void q.refetch()} className={cn(box, 'rounded-panel border border-line bg-surface-2 text-small text-ink-2')}>
          Could not load. Tap to retry
        </button>
      ) : !q.data ? (
        <SkeletonBlock className={box} />
      ) : (
        <a href={q.data} target="_blank" rel="noreferrer" className="block">
          <img src={q.data} alt={alt} loading="lazy" className={cn(box, 'rounded-panel border border-line bg-surface-2 object-cover')} />
        </a>
      )}
      <figcaption className="text-small text-ink-2">{caption}</figcaption>
    </figure>
  )
}

type OfficeTrip = Pick<Trip, 'id' | 'trip_number' | 'status'> & { driverName?: string | null }

/** The step the office records next: from Loaded it goes straight to Delivered. */
export function officeStep(status: string): TripStep | null {
  return status === 'loaded' ? 'delivered' : nextStep(status)
}

/** Admin or dispatcher records a step for the driver, with a reason. */
export function OfficeStepDialog({ trip, onClose }: { trip: OfficeTrip | null; onClose: () => void }) {
  const toast = useToast()
  const record = useRecordTripStep()
  const [reason, setReason] = useState('')
  const [receipt, setReceipt] = useState('')
  const step = trip ? officeStep(trip.status) : null
  useEffect(() => {
    if (trip) {
      setReason('')
      setReceipt('')
    }
  }, [trip])
  if (!trip || !step) return null
  const label = STEP_LABEL[step].toLowerCase()

  const submit = async () => {
    try {
      await record.mutateAsync({ tripId: trip.id, step, reason, receipt: step === 'loaded' ? receipt : undefined })
      toast.success(`${trip.trip_number} marked ${label}.`)
      onClose()
    } catch (err) {
      toast.error(err, 'Could not record the step.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Mark ${trip.trip_number} ${label}?`}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button block className="md:w-auto" loading={record.isPending} disabled={!reason.trim()} onClick={() => void submit()}>
            Mark {label}
          </Button>
          <Button variant="secondary" block className="md:w-auto" disabled={record.isPending} onClick={onClose}>
            Keep as is
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink-2">
          Use this only when {trip.driverName ?? 'the driver'} cannot record it from their phone. It shows as “Recorded by office” in the
          history{step === 'delivered' ? ', with no delivery location' : ''}.
        </p>
        {step === 'loaded' && (
          <Field label="Loader receipt no." hint="Optional">
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} value={receipt} maxLength={40} onChange={(e) => setReceipt(e.target.value)} />}
          </Field>
        )}
        <Field label="Why is the office recording this?" required>
          {(p) => (
            <Textarea id={p.id} aria-describedby={p.describedBy} rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </Field>
      </div>
    </Modal>
  )
}

type BrokenTrip = Pick<Trip, 'id' | 'trip_number'> & { plate?: string | null }

/** A loaded or moving truck broke down: cancel its trip and add a replacement to dispatch. */
export function BreakdownDialog({
  trip,
  onClose,
  onReplacement,
}: {
  trip: BrokenTrip | null
  onClose: () => void
  onReplacement: (t: Trip) => void
}) {
  const toast = useToast()
  const report = useReportBreakdown()
  const [reason, setReason] = useState('')
  const [load, setLoad] = useState<BreakdownLoad | ''>('')
  useEffect(() => {
    if (trip) {
      setReason('')
      setLoad('')
    }
  }, [trip])
  if (!trip) return null

  const submit = async () => {
    if (!load) return
    try {
      const repl = await report.mutateAsync({ tripId: trip.id, reason, load })
      toast.success(`${trip.trip_number} cancelled. ${repl.trip_number} added — dispatch another truck now.`)
      onClose()
      onReplacement(repl)
    } catch (err) {
      toast.error(err, 'Could not report the breakdown.')
    }
  }

  const options: { value: BreakdownLoad; label: string; hint: string }[] = [
    { value: 'moved', label: 'Load moved to the new truck', hint: 'No new material is bought for the replacement trip.' },
    { value: 'lost', label: 'Load lost', hint: 'The replacement trip loads again at the source.' },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={`Truck ${trip.plate ?? ''} broke down?`}
      footer={
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button variant="danger" block className="md:w-auto" loading={report.isPending} disabled={!reason.trim() || !load} onClick={() => void submit()}>
            Cancel trip and replace
          </Button>
          <Button variant="secondary" block className="md:w-auto" disabled={report.isPending} onClick={onClose}>
            Keep as is
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink-2">
          Trip <span className="num">{trip.trip_number}</span> is cancelled and the truck goes into maintenance. A replacement trip is added to the same
          order at the same price, ready to dispatch. The customer pays nothing extra.
        </p>
        <Field label="What happened?" required>
          {(p) => (
            <Textarea id={p.id} aria-describedby={p.describedBy} rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="micro-label mb-2">
            The load<span className="text-danger"> *</span>
          </legend>
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex min-h-touch cursor-pointer items-start gap-3 rounded-panel border bg-panel p-3',
                load === o.value ? 'border-ink' : 'border-line',
              )}
            >
              <input type="radio" name="breakdown-load" value={o.value} checked={load === o.value} onChange={() => setLoad(o.value)} className="peer sr-only" />
              <span
                aria-hidden
                className={cn(
                  'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
                  load === o.value ? 'border-ink' : 'border-ink-3',
                )}
              >
                {load === o.value && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
              </span>
              <span>
                <span className="block font-semibold text-ink">{o.label}</span>
                <span className="block text-small text-ink-2">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </Modal>
  )
}
