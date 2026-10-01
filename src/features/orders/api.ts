import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import * as orders from '@/services/orders'
import * as trips from '@/services/trips'

export const orderKeys = {
  all: ['orders'] as const,
  list: (f: { status: orders.OrderStatusFilter; search: string }) => ['orders', 'list', f] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  trips: (id: string) => ['orders', 'trips', id] as const,
  events: (id: string) => ['orders', 'events', id] as const,
  openLoads: (customerId: string) => ['orders', 'open-loads', customerId] as const,
}
export const dispatchKeys = { all: ['dispatch'] as const, mine: ['dispatch', 'mine'] as const }

/** Orders, trips, trucks and drivers all move together when dispatch changes. */
function invalidateDispatch(qc: QueryClient) {
  for (const key of [orderKeys.all, dispatchKeys.all, ['trucks'], ['drivers']]) qc.invalidateQueries({ queryKey: key })
}

export function useOrders(f: { status: orders.OrderStatusFilter; search: string }) {
  return useQuery({ queryKey: orderKeys.list(f), queryFn: () => orders.listOrders(f), placeholderData: keepPreviousData })
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: orderKeys.detail(id ?? ''), queryFn: () => orders.getOrder(id!), enabled: Boolean(id) })
}

export function useOrderTrips(id: string) {
  return useQuery({ queryKey: orderKeys.trips(id), queryFn: () => trips.listTripsForOrder(id) })
}

export function useOrderEvents(id: string) {
  return useQuery({ queryKey: orderKeys.events(id), queryFn: () => trips.listEventsForOrder(id) })
}

export function useOpenLoads(customerId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: orderKeys.openLoads(customerId ?? ''),
    queryFn: () => orders.openLoadsForCustomer(customerId!),
    enabled: Boolean(customerId) && enabled,
  })
}

export function useDispatchTrips() {
  return useQuery({ queryKey: dispatchKeys.all, queryFn: trips.listDispatchTrips, refetchInterval: 60_000 })
}

export function useMyTrips() {
  return useQuery({ queryKey: dispatchKeys.mine, queryFn: trips.listMyTrips, refetchInterval: 60_000 })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: orders.createOrder, onSuccess: () => invalidateDispatch(qc) })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) => orders.cancelOrder(v.id, v.reason),
    onSuccess: () => invalidateDispatch(qc),
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: orders.recordOrderPayment, onSuccess: () => invalidateDispatch(qc) })
}

export function useAssignTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { tripId: string; driverId: string; truckId: string }) => trips.assignTrip(v.tripId, v.driverId, v.truckId),
    onSuccess: () => invalidateDispatch(qc),
  })
}

export function useCancelTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { tripId: string; reason: string }) => trips.cancelTrip(v.tripId, v.reason),
    onSuccess: () => invalidateDispatch(qc),
  })
}

export function useUnassignTrip() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (tripId: string) => trips.unassignTrip(tripId), onSuccess: () => invalidateDispatch(qc) })
}
