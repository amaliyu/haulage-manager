import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as svc from '@/services/profiles'

export const profileKeys = { all: ['profiles'] as const }

export function useProfiles(enabled = true) {
  return useQuery({ queryKey: profileKeys.all, queryFn: svc.listProfiles, enabled })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; patch: Parameters<typeof svc.updateProfile>[1] }) => svc.updateProfile(v.id, v.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  })
}

export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.createProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  })
}
