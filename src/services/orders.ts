import { supabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Tables } from '@/types/database'
import { ilikeTerm, unwrap, unwrapList } from './_shared'

export type Order = Tables<'orders'>
export type OrderStatus = 'draft' | 'awaiting_payment' | 'ready' | 'in_progress' | 'completed' | 'cancelled'
export type PaymentMethod = 'bank_transfer' | 'cash' | 'pos' | 'other'
export const PAYMENT_METHODS: PaymentMethod[] = ['bank_transfer', 'cash', 'pos', 'other']

export type OrderWithRefs = Order & {
  customer: Pick<Tables<'customers'>, 'id' | 'name' | 'phone' | 'payment_terms' | 'credit_load_cap'> | null
  site: Pick<Tables<'customer_sites'>, 'id' | 'name' | 'area'> | null
  route: Pick<Tables<'routes'>, 'id' | 'name' | 'diesel_allowance_litres'> | null
  trips: Pick<Tables<'trips'>, 'id' | 'status'>[]
  /** Null for roles that cannot read payments (dispatcher). */
  payment: Pick<Tables<'payments'>, 'id' | 'amount' | 'method' | 'bank_reference' | 'received_at'> | null
}

const SELECT = [
  '*',
  'customer:customers(id, name, phone, payment_terms, credit_load_cap)',
  'site:customer_sites(id, name, area)',
  'route:routes(id, name, diesel_allowance_litres)',
  'trips(id, status)',
  'payment:payments(id, amount, method, bank_reference, received_at)',
].join(', ')

type Q<T> = PromiseLike<{ data: T | null; error: unknown }>

/** "open" = anything not completed or cancelled. */
export type OrderStatusFilter = 'open' | OrderStatus | 'all'

export async function listOrders(f: { status: OrderStatusFilter; search: string }): Promise<OrderWithRefs[]> {
  let q = supabase.from('orders').select(SELECT).order('created_at', { ascending: false }).limit(300)
  if (f.status === 'open') q = q.not('status', 'in', '(completed,cancelled)')
  else if (f.status !== 'all') q = q.eq('status', f.status)
  const term = f.search.trim()
  if (term) {
    // Customer names live on another table: find matching ids first.
    const customers = await unwrapList(
      supabase.from('customers').select('id').ilike('name', ilikeTerm(term).replace(/\*/g, '%')).limit(100),
    )
    const ids = customers.map((c) => c.id)
    const parts = [`order_number.ilike.${ilikeTerm(term)}`]
    if (ids.length) parts.push(`customer_id.in.(${ids.join(',')})`)
    q = q.or(parts.join(','))
  }
  return unwrapList(q as unknown as Q<OrderWithRefs[]>)
}

export function getOrder(id: string): Promise<OrderWithRefs> {
  return unwrap(supabase.from('orders').select(SELECT).eq('id', id).single() as unknown as Q<OrderWithRefs>)
}

export function createOrder(v: { customerId: string; siteId: string; routeId: string; trips: number; notes: string | null }): Promise<Order> {
  return unwrap(
    supabase
      .rpc('create_order', {
        p_customer_id: v.customerId,
        p_site_id: v.siteId,
        p_route_id: v.routeId,
        p_trips: v.trips,
        p_notes: v.notes ?? undefined,
      })
      .single(),
  )
}

export function cancelOrder(id: string, reason: string): Promise<Order> {
  return unwrap(supabase.rpc('cancel_order', { p_order_id: id, p_reason: reason }).single())
}

export function recordOrderPayment(v: {
  orderId: string
  amount: number
  method: PaymentMethod
  bankReference: string | null
  receivedAt: string
  note: string | null
}): Promise<Order> {
  return unwrap(
    supabase
      .rpc('record_order_payment', {
        p_order_id: v.orderId,
        p_amount: v.amount,
        p_method: v.method,
        p_bank_reference: v.bankReference ?? '',
        p_received_at: v.receivedAt,
        p_note: v.note ?? undefined,
      })
      .single(),
  )
}

/** Loads dispatched but not yet settled for a credit customer (counts against the credit cap). */
export async function openLoadsForCustomer(customerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('trips')
    .select('id, order:orders!inner(customer_id)', { count: 'exact', head: true })
    .eq('order.customer_id', customerId)
    .in('status', ['assigned', 'loaded', 'in_transit', 'delivered'])
  if (error) throw toAppError(error)
  return count ?? 0
}

/** Totals over the trips that still count (not cancelled). */
export function orderTotals(o: Pick<OrderWithRefs, 'price_per_trip' | 'trips'>) {
  const live = o.trips.filter((t) => t.status !== 'cancelled')
  const done = live.filter((t) => t.status === 'delivered' || t.status === 'settled').length
  return { live: live.length, done, cancelled: o.trips.length - live.length, total: live.length * o.price_per_trip }
}

/** "0 of 1 delivered · 1 cancelled" */
export function tripProgress(t: { live: number; done: number; cancelled: number }) {
  return `${t.done} of ${t.live} delivered${t.cancelled ? ` · ${t.cancelled} cancelled` : ''}`
}

/** Money paid beyond what the order now costs (after cancelled trips). Kept as customer credit. */
export function overpaid(o: Pick<OrderWithRefs, 'price_per_trip' | 'trips' | 'payment'>) {
  if (!o.payment) return 0
  return Math.max(0, o.payment.amount - orderTotals(o).total)
}
