import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import { ilikeTerm, unwrap, unwrapList, type ActiveFilter } from './_shared'
import type { RoutePrice } from './routePrices'

export type Route = Tables<'routes'>
export type RouteInput = Omit<TablesInsert<'routes'>, 'id' | 'created_at' | 'updated_at' | 'created_by'>

export type RouteWithCurrent = Route & {
  source: Pick<Tables<'material_sources'>, 'id' | 'name' | 'material'> | null
  current_price: RoutePrice | null
}

const SELECT = '*, source:material_sources(id, name, material), prices:route_prices(*)'

type RawRoute = Route & {
  source: RouteWithCurrent['source']
  prices: RoutePrice[] | null
}

function withCurrent(r: RawRoute): RouteWithCurrent {
  const { prices, ...rest } = r
  return { ...rest, current_price: (prices ?? []).find((p) => p.effective_to === null) ?? null }
}

export async function listRoutes(f: { search?: string; active?: ActiveFilter } = {}): Promise<RouteWithCurrent[]> {
  let q = supabase
    .from('routes')
    .select(SELECT)
    .order('name')
  if (f.search?.trim()) {
    const t = ilikeTerm(f.search)
    q = q.or(`name.ilike.${t},destination_area.ilike.${t}`)
  }
  if (f.active && f.active !== 'all') q = q.eq('is_active', f.active === 'active')
  const rows = await unwrapList<RawRoute>(q as unknown as PromiseLike<{ data: RawRoute[] | null; error: unknown }>)
  return rows.map(withCurrent)
}

export async function getRoute(id: string): Promise<RouteWithCurrent> {
  const row = await unwrap(
    supabase
      .from('routes')
      .select(SELECT)
      .eq('id', id)
      .single() as unknown as PromiseLike<{ data: RawRoute | null; error: unknown }>,
  )
  return withCurrent(row)
}

export function createRoute(input: RouteInput): Promise<Route> {
  return unwrap(supabase.from('routes').insert(input).select('*').single())
}

export function updateRoute(id: string, patch: TablesUpdate<'routes'>): Promise<Route> {
  return unwrap(supabase.from('routes').update(patch).eq('id', id).select('*').single())
}
