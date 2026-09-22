import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as svc from '@/services/materialSources'
import type { ActiveFilter } from '@/services/_shared'
import type { TablesUpdate } from '@/types/database'

export const sourceKeys = {
  all: ['material_sources'] as const,
  list: (f: { search?: string; active?: ActiveFilter }) => ['material_sources', 'list', f] as const,
}

export function useSources(f: { search?: string; active?: ActiveFilter } = {}) {
  return useQuery({ queryKey: sourceKeys.list(f), queryFn: () => svc.listMaterialSources(f), placeholderData: keepPreviousData })
}

export function useSaveSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id?: string; input: svc.MaterialSourceInput | TablesUpdate<'material_sources'> }) =>
      v.id ? svc.updateMaterialSource(v.id, v.input) : svc.createMaterialSource(v.input as svc.MaterialSourceInput),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sourceKeys.all })
      qc.invalidateQueries({ queryKey: ['routes'] })
    },
  })
}
