import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as svc from '@/services/drivers'
import type { ActiveFilter } from '@/services/_shared'
import type { TablesUpdate } from '@/types/database'

export const driverKeys = {
  all: ['drivers'] as const,
  list: (f: { search?: string; active?: ActiveFilter }) => ['drivers', 'list', f] as const,
  detail: (id: string) => ['drivers', 'detail', id] as const,
  own: ['drivers', 'own'] as const,
}

export function useDrivers(f: { search?: string; active?: ActiveFilter } = {}) {
  return useQuery({ queryKey: driverKeys.list(f), queryFn: () => svc.listDrivers(f), placeholderData: keepPreviousData })
}

export function useDriver(id: string | undefined) {
  return useQuery({ queryKey: driverKeys.detail(id ?? ''), queryFn: () => svc.getDriver(id!), enabled: Boolean(id) })
}

export function useOwnDriver() {
  return useQuery({ queryKey: driverKeys.own, queryFn: svc.getOwnDriver })
}

export function useSaveDriver() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id?: string; input: svc.DriverInput | TablesUpdate<'drivers'> }) =>
      v.id ? svc.updateDriver(v.id, v.input) : svc.createDriver(v.input as svc.DriverInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: driverKeys.all }),
  })
}
