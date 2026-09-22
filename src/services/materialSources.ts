import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import { ilikeTerm, unwrap, unwrapList, type ActiveFilter } from './_shared'

export type MaterialSource = Tables<'material_sources'>
export type MaterialSourceInput = Omit<TablesInsert<'material_sources'>, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type Material = 'sharp_sand' | 'filling_sand' | 'granite' | 'laterite' | 'other'
export const MATERIALS: Material[] = ['sharp_sand', 'filling_sand', 'granite', 'laterite', 'other']

export function listMaterialSources(f: { search?: string; active?: ActiveFilter } = {}): Promise<MaterialSource[]> {
  let q = supabase.from('material_sources').select('*').order('name')
  if (f.search?.trim()) {
    const t = ilikeTerm(f.search)
    q = q.or(`name.ilike.${t},area.ilike.${t}`)
  }
  if (f.active && f.active !== 'all') q = q.eq('is_active', f.active === 'active')
  return unwrapList(q)
}

export function createMaterialSource(input: MaterialSourceInput): Promise<MaterialSource> {
  return unwrap(supabase.from('material_sources').insert(input).select('*').single())
}

export function updateMaterialSource(id: string, patch: TablesUpdate<'material_sources'>): Promise<MaterialSource> {
  return unwrap(supabase.from('material_sources').update(patch).eq('id', id).select('*').single())
}
