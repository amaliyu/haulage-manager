import { supabase, TRIP_PHOTOS_BUCKET } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Database, Tables } from '@/types/database'
import { unwrap, unwrapList } from './_shared'

export type Trip = Tables<'trips'>
export type TripStatus = 'pending' | 'assigned' | 'loaded' | 'in_transit' | 'delivered' | 'settled' | 'disputed' | 'cancelled'
export const ACTIVE_TRIP_STATUSES: TripStatus[] = ['assigned', 'loaded', 'in_transit']

type Q<T> = PromiseLike<{ data: T | null; error: unknown }>

export type TripStep = 'loaded' | 'in_transit' | 'delivered'
export type PhotoType = 'loading' | 'delivery'
export type DeliveryCheck = 'inside' | 'outside' | 'no_site_pin' | 'no_location'
export type BreakdownLoad = 'moved' | 'lost'
export type TripPhoto = Pick<Tables<'trip_photos'>, 'id' | 'photo_type' | 'storage_path' | 'taken_at'>

export type TripWithCrew = Trip & {
  driver: Pick<Tables<'drivers'>, 'id' | 'full_name' | 'phone'> | null
  truck: Pick<Tables<'trucks'>, 'id' | 'plate_number' | 'reference_load_photo_url'> | null
  photos: TripPhoto[]
}

const CREW =
  'driver:drivers(id, full_name, phone), truck:trucks(id, plate_number, reference_load_photo_url), photos:trip_photos(id, photo_type, storage_path, taken_at)'

/** The step a trip moves to next, or null when the driver has nothing left to record. */
export function nextStep(status: string): TripStep | null {
  if (status === 'assigned') return 'loaded'
  if (status === 'loaded') return 'in_transit'
  if (status === 'in_transit') return 'delivered'
  return null
}

/** Statuses after loading, when a loading photo is expected. */
const LOADED_OR_LATER = ['loaded', 'in_transit', 'delivered', 'settled', 'disputed']

export type TripFlag = { label: string; tone: 'ok' | 'warn' | 'info' | 'neutral' }

/** What the office should notice about a trip, worst first. */
export function tripFlags(t: {
  status: string
  delivery_check: string | null
  delivery_distance_m: number | null
  office_recorded: boolean
  breakdown_load?: string | null
  replaces_trip_id?: string | null
  loadingPhotos: number
}): TripFlag[] {
  const f: TripFlag[] = []
  if (t.breakdown_load) f.push({ label: t.breakdown_load === 'moved' ? 'Broke down · load moved' : 'Broke down · load lost', tone: 'warn' })
  if (t.delivery_check === 'outside') f.push({ label: `Outside site (${(t.delivery_distance_m ?? 0).toLocaleString('en-NG')}m)`, tone: 'warn' })
  if (t.delivery_check === 'no_location') f.push({ label: 'No location', tone: 'warn' })
  if (t.delivery_check === 'no_site_pin') f.push({ label: 'No site pin', tone: 'neutral' })
  if (LOADED_OR_LATER.includes(t.status) && t.loadingPhotos === 0) f.push({ label: 'No load photo', tone: 'warn' })
  if (t.office_recorded) f.push({ label: 'Recorded by office', tone: 'info' })
  if (t.replaces_trip_id) f.push({ label: 'Replacement', tone: 'info' })
  if (t.delivery_check === 'inside') f.push({ label: 'Inside site', tone: 'ok' })
  return f
}

export const countPhotos = (photos: { photo_type: string }[] | null | undefined, type: PhotoType) =>
  (photos ?? []).filter((p) => p.photo_type === type).length

export function listTripsForOrder(orderId: string): Promise<TripWithCrew[]> {
  return unwrapList(
    supabase.from('trips').select(`*, ${CREW}`).eq('order_id', orderId).order('trip_number') as unknown as Q<TripWithCrew[]>,
  )
}

export type DispatchTrip = TripWithCrew & {
  order: Pick<Tables<'orders'>, 'id' | 'order_number' | 'status' | 'payment_terms' | 'material' | 'created_at'> & {
    customer: Pick<Tables<'customers'>, 'id' | 'name'> | null
    site: Pick<Tables<'customer_sites'>, 'id' | 'name' | 'area'> | null
    route: Pick<Tables<'routes'>, 'id' | 'name'> | null
  }
}

/** Everything the dispatcher needs today: trips waiting and trips on the road. */
export function listDispatchTrips(): Promise<DispatchTrip[]> {
  return unwrapList(
    supabase
      .from('trips')
      .select(
        `*, ${CREW}, order:orders!inner(id, order_number, status, payment_terms, material, created_at, customer:customers(id, name), site:customer_sites(id, name, area), route:routes(id, name))`,
      )
      .in('status', ['pending', ...ACTIVE_TRIP_STATUSES])
      .not('order.status', 'in', '(cancelled,completed)')
      .order('trip_number')
      .limit(500) as unknown as Q<DispatchTrip[]>,
  )
}

export function assignTrip(tripId: string, driverId: string, truckId: string): Promise<Trip> {
  return unwrap(supabase.rpc('assign_trip', { p_trip_id: tripId, p_driver_id: driverId, p_truck_id: truckId }).single())
}

export function cancelTrip(tripId: string, reason: string): Promise<Trip> {
  return unwrap(supabase.rpc('cancel_trip', { p_trip_id: tripId, p_reason: reason }).single())
}

/** Take a trip back off its driver and truck (it returns to "to dispatch"). */
export function unassignTrip(tripId: string): Promise<Trip> {
  return unwrap(supabase.from('trips').update({ status: 'pending' }).eq('id', tripId).select('*').single())
}

export type TripEvent = Tables<'trip_events'> & { trip: Pick<Trip, 'trip_number'> | null; actor: { full_name: string } | null }

export function listEventsForOrder(orderId: string): Promise<TripEvent[]> {
  return unwrapList(
    supabase
      .from('trip_events')
      .select('*, trip:trips!inner(trip_number, order_id), actor:profiles!trip_events_actor_id_fkey(full_name)')
      .eq('trip.order_id', orderId)
      .order('occurred_at', { ascending: false })
      .limit(200) as unknown as Q<TripEvent[]>,
  )
}

export type MyTrip = Database['public']['Functions']['my_trips']['Returns'][number]

export function listMyTrips(): Promise<MyTrip[]> {
  return unwrapList(supabase.rpc('my_trips') as unknown as Q<MyTrip[]>)
}

export type StepPosition = { latitude: number; longitude: number; accuracy: number } | null

export function recordTripStep(v: {
  tripId: string
  step: TripStep
  position?: StepPosition
  receipt?: string
  reason?: string
}): Promise<Trip> {
  return unwrap(
    supabase
      .rpc('record_trip_step', {
        p_trip_id: v.tripId,
        p_step: v.step,
        p_lat: v.position?.latitude ?? undefined,
        p_lng: v.position?.longitude ?? undefined,
        p_accuracy_m: v.position?.accuracy ?? undefined,
        p_loader_receipt_no: v.receipt?.trim() || undefined,
        p_reason: v.reason?.trim() || undefined,
      })
      .single(),
  )
}

/** Cancels the broken-down trip and returns the replacement trip to dispatch. */
export function reportBreakdown(tripId: string, reason: string, load: BreakdownLoad): Promise<Trip> {
  return unwrap(supabase.rpc('report_breakdown', { p_trip_id: tripId, p_reason: reason, p_load: load }).single())
}

/** Upload a JPEG to trips/{id}/{type}-{ms}.jpg and record it against the trip. */
export async function uploadTripPhoto(v: { tripId: string; type: PhotoType; jpeg: Blob; position?: StepPosition }): Promise<void> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) throw new Error('You are signed out. Sign in again and retry.')
  const path = `trips/${v.tripId}/${v.type}-${Date.now()}.jpg`
  const up = await supabase.storage.from(TRIP_PHOTOS_BUCKET).upload(path, v.jpeg, { contentType: 'image/jpeg', upsert: false })
  if (up.error) throw toAppError(up.error, 'Could not send the photo.')
  const { error } = await supabase.from('trip_photos').insert({
    trip_id: v.tripId,
    photo_type: v.type,
    storage_path: path,
    latitude: v.position?.latitude ?? null,
    longitude: v.position?.longitude ?? null,
    taken_at: new Date().toISOString(),
    uploaded_by: userId,
  })
  if (error) throw toAppError(error, 'Could not save the photo.')
}

/** Midnight today in Lagos (UTC+1, no daylight saving) as an ISO string. */
export function startOfLagosDay(now = new Date()): string {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000)
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - 60 * 60 * 1000).toISOString()
}

/** Trips delivered since midnight, and how many the office should check. */
export async function deliveredToday(): Promise<{ total: number; flagged: number }> {
  const rows = await unwrapList(
    supabase
      .from('trips')
      .select('id, delivery_check')
      .in('status', ['delivered', 'settled', 'disputed'])
      .gte('delivered_at', startOfLagosDay()) as unknown as Q<Pick<Trip, 'id' | 'delivery_check'>[]>,
  )
  return { total: rows.length, flagged: rows.filter((r) => r.delivery_check === 'outside' || r.delivery_check === 'no_location').length }
}
