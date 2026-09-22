import { Clock, Phone, Truck } from 'lucide-react'
import { Card, ErrorState, Facts, PageHeader, SkeletonBlock } from '@/components/ui'
import { useProfile } from '@/hooks/useAuth'
import { useOwnDriver } from '@/features/drivers/api'
import { TruckStatusPill } from '@/features/trucks/labels'

export function DriverHomePage() {
  const profile = useProfile()
  const me = useOwnDriver()

  return (
    <div className="max-w-[560px]">
      <PageHeader title={`Welcome, ${profile.full_name.split(' ')[0]}`} />
      <Card emphasis>
        <div className="flex items-start gap-3">
          <Clock size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-brand" aria-hidden />
          <div>
            <h2 className="text-section">Trips coming soon</h2>
            <p className="mt-1 text-body text-ink-2">
              Your trips, loading photos and delivery confirmation will appear here when dispatch goes live. Keep this app
              installed and signed in.
            </p>
          </div>
        </div>
      </Card>
      <div className="mt-4">
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
          <Card title="Your truck">
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
