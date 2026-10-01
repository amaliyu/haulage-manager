import { StatusPill, type StatusTone } from '@/components/ui'
import type { OrderStatus, PaymentMethod } from '@/services/orders'
import type { TripStatus } from '@/services/trips'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Draft',
  awaiting_payment: 'Awaiting payment',
  ready: 'Ready',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const ORDER_TONE: Record<OrderStatus, StatusTone> = {
  draft: 'neutral',
  awaiting_payment: 'warn',
  ready: 'info',
  in_progress: 'accent',
  completed: 'ok',
  cancelled: 'neutral',
}

export function OrderStatusPill({ status }: { status: string }) {
  const s = status as OrderStatus
  return <StatusPill tone={ORDER_TONE[s] ?? 'neutral'}>{ORDER_STATUS_LABEL[s] ?? status}</StatusPill>
}

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  pending: 'To dispatch',
  assigned: 'Assigned',
  loaded: 'Loaded',
  in_transit: 'In transit',
  delivered: 'Delivered',
  settled: 'Settled',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
}
const TRIP_TONE: Record<TripStatus, StatusTone> = {
  pending: 'warn',
  assigned: 'info',
  loaded: 'accent',
  in_transit: 'accent',
  delivered: 'ok',
  settled: 'ok',
  disputed: 'danger',
  cancelled: 'neutral',
}

export function TripStatusPill({ status }: { status: string }) {
  const s = status as TripStatus
  return <StatusPill tone={TRIP_TONE[s] ?? 'neutral'}>{TRIP_STATUS_LABEL[s] ?? status}</StatusPill>
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  pos: 'POS',
  other: 'Other',
}

export function paymentMethodLabel(m: string | null | undefined) {
  return m ? (PAYMENT_METHOD_LABEL[m as PaymentMethod] ?? m) : '—'
}
