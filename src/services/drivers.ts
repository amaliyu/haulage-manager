import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import { ilikeTerm, unwrap, unwrapList, type ActiveFilter } from './_shared'

export type Driver = Tables<'drivers'>
export type DriverInput = Omit<TablesInsert<'drivers'>, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type DriverWithTruck = Driver & { truck: Pick<Tables<'trucks'>, 'id' | 'plate_number' | 'status'> | null }

const SELECT = '*, truck:trucks!drivers_assigned_truck_id_fkey(id, plate_number, status)'

export function listDrivers(f: { search?: string; active?: ActiveFilter } = {}): Promise<DriverWithTruck[]> {
  let q = supabase.from('drivers').select(SELECT).order('full_name')
  if (f.search?.trim()) {
    const t = ilikeTerm(f.search)
    q = q.or(`full_name.ilike.${t},phone.ilike.${t},licence_number.ilike.${t}`)
  }
  if (f.active && f.active !== 'all') q = q.eq('is_active', f.active === 'active')
  return unwrapList(q as unknown as PromiseLike<{ data: DriverWithTruck[] | null; error: unknown }>)
}

export function getDriver(id: string): Promise<DriverWithTruck> {
  return unwrap(
    supabase.from('drivers').select(SELECT).eq('id', id).single() as unknown as PromiseLike<{
      data: DriverWithTruck | null
      error: unknown
    }>,
  )
}

/** The signed-in driver's own row (RLS returns only theirs), or null. */
export async function getOwnDriver(): Promise<DriverWithTruck | null> {
  const rows = await listDrivers()
  return rows[0] ?? null
}

export function createDriver(input: DriverInput): Promise<Driver> {
  return unwrap(supabase.from('drivers').insert(input).select('*').single())
}

export function updateDriver(id: string, patch: TablesUpdate<'drivers'>): Promise<Driver> {
  return unwrap(supabase.from('drivers').update(patch).eq('id', id).select('*').single())
}
