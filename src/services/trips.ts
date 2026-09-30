import { supabase } from '@/lib/supabase'
import type { Database, Tables } from '@/types/database'
import { unwrap, unwrapList } from './_shared'

export type Trip = Tables<'trips'>
export type TripStatus = 'pending' | 'assigned' | 'loaded' | 'in_transit' | 'delivered' | 'settled' | 'disputed' | 'cancelled'
export const ACTIVE_TRIP_STATUSES: TripStatus[] = ['assigned', 'loaded', 'in_transit']

type Q<T> = PromiseLike<{ data: T | null; error: unknown }>

export type TripWithCrew = Trip & {
  driver: Pick<Tables<'drivers'>, 'id' | 'full_name' | 'phone'> | null
  truck: Pick<Tables<'trucks'>, 'id' | 'plate_number' | 'reference_load_photo_url'> | null
}

const CREW = 'driver:drivers(id, full_name, phone), truck:trucks(id, plate_number, reference_load_photo_url)'

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
