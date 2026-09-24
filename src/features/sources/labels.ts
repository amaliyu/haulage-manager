import type { Material } from '@/services/materialSources'

export const MATERIAL_LABEL: Record<Material, string> = {
  sharp_sand: 'Sharp sand',
  filling_sand: 'Filling sand',
  granite: 'Granite',
  laterite: 'Laterite',
  other: 'Other',
}

export function materialLabel(m: string | null | undefined) {
  return m ? (MATERIAL_LABEL[m as Material] ?? m) : '—'
}
