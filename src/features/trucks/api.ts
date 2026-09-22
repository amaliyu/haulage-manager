import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as svc from '@/services/trucks'
import type { TablesUpdate } from '@/types/database'

export const truckKeys = {
  all: ['trucks'] as const,
  list: (f: svc.TruckFilters) => ['trucks', 'list', f] as const,
  detail: (id: string) => ['trucks', 'detail', id] as const,
  photo: (path: string) => ['trucks', 'photo', path] as const,
}

export function useTrucks(f: svc.TruckFilters = {}) {
  return useQuery({ queryKey: truckKeys.list(f), queryFn: () => svc.listTrucks(f), placeholderData: keepPreviousData })
}

export function useTruck(id: string | undefined) {
  return useQuery({ queryKey: truckKeys.detail(id ?? ''), queryFn: () => svc.getTruck(id!), enabled: Boolean(id) })
}

export function useTruckPhotoUrl(path: string | null | undefined, version?: string | null) {
  return useQuery({
    queryKey: [...truckKeys.photo(path ?? ''), version ?? ''],
    queryFn: () => svc.getPhotoUrl(path!),
    enabled: Boolean(path),
    staleTime: 5 * 60 * 1000,
  })
}

export function useSaveTruck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id?: string; input: svc.TruckInput | TablesUpdate<'trucks'> }) =>
      v.id ? svc.updateTruck(v.id, v.input) : svc.createTruck(v.input as svc.TruckInput),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: truckKeys.all })
      qc.invalidateQueries({ queryKey: ['drivers'] })
    },
  })
}

export function useUploadTruckPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { truckId: string; jpeg: Blob }) => svc.uploadTruckReferencePhoto(v.truckId, v.jpeg),
    onSuccess: () => qc.invalidateQueries({ queryKey: truckKeys.all }),
  })
}
