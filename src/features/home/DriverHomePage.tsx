import { useState, type ReactNode } from 'react'
import { CheckCircle2, MapPin, PackageCheck, Phone, Truck } from 'lucide-react'
import { Button, Card, EmptyState, ErrorState, Facts, PageHeader, SkeletonBlock } from '@/components/ui'
import { formatDateTime, formatTime } from '@/lib/format'
import { nextStep, type MyTrip, type TripStep } from '@/services/trips'
import { useMyTrips } from '@/features/orders/api'
import { TripStatusPill } from '@/features/orders/labels'
import { materialLabel } from '@/features/sources/labels'
import { useProfile } from '@/hooks/useAuth'
import { useOwnDriver } from '@/features/drivers/api'
import { TruckStatusPill } from '@/features/trucks/labels'
import { DriverStepSheet } from './DriverStepSheet'

export function DriverHomePage() {
  const profile = useProfile()
  const me = useOwnDriver()

  return (
    <div className="max-w-[560px]">
      <PageHeader title={`Welcome, ${profile.full_name.split(' ')[0]}`} />
      <MyTripsSection />
      <div className="mt-8">
        {me.isLoading ? (
          <SkeletonBlock className="h-[120px] w-full" />
        ) : me.isError ? (
          <ErrorState what="Could not load your driver record." error={me.error} onRetry={() => void me.refetch()} />
        ) : !me.data ? (
          <Card>
            <p className="text-body text-ink-2">
              Your login is not linked to a driver record yet. Ask the office to link it so your truck shows here.
            </p>
          </Card>
        ) : (
          <Card title="Your usual truck">
            <Facts
              items={[
                {
                  label: 'Truck',
                  value: me.data.truck ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <Truck size={20} strokeWidth={1.5} aria-hidden />
                      <span className="num font-display text-section font-bold">{me.data.truck.plate_number}</span>
                      <TruckStatusPill status={me.data.truck.status} />
                    </span>
                  ) : (
                    'No truck assigned yet'
                  ),
                },
                {
                  label: 'Phone on record',
                  value: (
                    <span className="inline-flex items-center gap-2">
                      <Phone size={20} strokeWidth={1.5} aria-hidden />
                      <span className="num">{me.data.phone}</span>
                    </span>
                  ),
                },
                { label: 'Licence', value: <span className="num">{me.data.licence_number ?? 'Not recorded'}</span> },
              ]}
            />
          </Card>
        )}
      </div>
    </div>
  )
}

function MyTripsSection() {
  const q = useMyTrips()
  const [sheet, setSheet] = useState<{ trip: MyTrip; step: TripStep } | null>(null)
  if (q.isLoading) return <SkeletonBlock className="h-[200px] w-full" />
  if (q.isError) return <ErrorState what="Could not load your trips." error={q.error} onRetry={() => void q.refetch()} />
  const active = (q.data ?? []).filter((t) => nextStep(t.status))
  const done = (q.data ?? []).filter((t) => !nextStep(t.status))
  return (
    <div className="flex flex-col gap-4">
      {active.length === 0 ? (
        <EmptyState message="No trip assigned to you right now. The office will dispatch you here." />
      ) : (
        active.map((t) => <TripCard key={t.trip_id} t={t} onStep={(step) => setSheet({ trip: t, step })} />)
      )}
      {done.length > 0 && (
        <section aria-labelledby="done-today">
          <h2 id="done-today" className="mb-3 mt-4 text-section">
            Done today · <span className="num">{done.length}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {done.map((t) => (
              <li key={t.trip_id} className="flex min-h-[72px] items-center gap-3 rounded-panel border border-line bg-panel p-3">
                <CheckCircle2 size={20} strokeWidth={1.5} className="shrink-0 text-ok" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="num block font-semibold text-ink">{t.trip_number}</span>
                  <span className="block text-small text-ink-2">
                    {t.site_name} · {t.site_area}
                  </span>
                </span>
                <span className="num shrink-0 text-small text-ink-2">{formatTime(t.delivered_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {sheet && <DriverStepSheet trip={sheet.trip} step={sheet.step} onClose={() => setSheet(null)} />}
    </div>
  )
}

const STEP_BUTTON: Record<TripStep, { label: string; icon: ReactNode }> = {
  loaded: { label: "I've loaded", icon: <PackageCheck size={20} strokeWidth={1.5} aria-hidden /> },
  in_transit: { label: "I've left the loading site", icon: <Truck size={20} strokeWidth={1.5} aria-hidden /> },
  delivered: { label: "I've delivered", icon: <CheckCircle2 size={20} strokeWidth={1.5} aria-hidden /> },
}

function TripCard({ t, onStep }: { t: MyTrip; onStep: (s: TripStep) => void }) {
  const hasCoords = t.site_latitude != null && t.site_longitude != null
  const step = nextStep(t.status)
  return (
    <Card emphasis title={<span className="num">{t.trip_number}</span>} action={<TripStatusPill status={t.status} />}>
      {step && (
        <div className="mb-4 flex flex-col gap-2">
          <Button block icon={STEP_BUTTON[step].icon} onClick={() => onStep(step)}>
            {STEP_BUTTON[step].label}
          </Button>
          {step === 'in_transit' && (
            <Button variant="secondary" block icon={STEP_BUTTON.delivered.icon} onClick={() => onStep('delivered')}>
              {STEP_BUTTON.delivered.label}
            </Button>
          )}
        </div>
      )}
      <Facts
        items={[
          { label: 'Deliver to', value: <span className="font-semibold">{t.site_name} · {t.site_area}</span> },
          { label: 'Customer', value: t.customer_name },
          {
            label: 'Customer phone',
            value: (
              <a className="num inline-flex min-h-touch items-center gap-2 underline underline-offset-4" href={`tel:${t.customer_phone}`}>
                <Phone size={20} strokeWidth={1.5} aria-hidden />
                {t.customer_phone}
              </a>
            ),
          },
          { label: 'Load at', value: `${t.source_name ?? '—'} · ${materialLabel(t.material)}` },
          { label: 'Truck', value: <span className="num">{t.truck_plate}</span> },
          { label: 'Dispatched', value: formatDateTime(t.assigned_at), numeric: true },
          ...(t.loaded_at ? [{ label: 'Loaded', value: formatDateTime(t.loaded_at), numeric: true }] : []),
          ...(t.site_directions ? [{ label: 'Directions', value: t.site_directions }] : []),
        ]}
      />
      {hasCoords && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${t.site_latitude},${t.site_longitude}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex h-cta w-full items-center justify-center gap-2 rounded border border-line bg-panel font-display font-semibold text-ink no-underline"
        >
          <MapPin size={20} strokeWidth={1.5} aria-hidden />
          Open in Maps
        </a>
      )}
    </Card>
  )
}
