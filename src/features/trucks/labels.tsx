import { StatusPill, type StatusTone } from '@/components/ui'
import type { OwnerType, TruckStatus } from '@/services/trucks'

export const OWNER_LABEL: Record<OwnerType, string> = { spv: 'SPV', operator: 'Operator', partner: 'Partner' }
export const STATUS_LABEL: Record<TruckStatus, string> = {
  available: 'Available',
  on_trip: 'On trip',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
}
const STATUS_TONE: Record<TruckStatus, StatusTone> = { available: 'ok', on_trip: 'info', maintenance: 'warn', inactive: 'neutral' }

export function TruckStatusPill({ status }: { status: string }) {
  const s = status as TruckStatus
  return <StatusPill tone={STATUS_TONE[s] ?? 'neutral'}>{STATUS_LABEL[s] ?? status}</StatusPill>
}

export function ownerLabel(t: string) {
  return OWNER_LABEL[t as OwnerType] ?? t
}
