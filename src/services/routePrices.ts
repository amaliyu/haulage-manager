import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { unwrap, unwrapList } from './_shared'

export type RoutePrice = Tables<'route_prices'>
export type RoutePriceWithSetter = RoutePrice & { setter: { full_name: string } | null }

export type NewRoutePrice = {
  route_id: string
  customer_price: number
  material_cost: number
  diesel_price_per_litre: number
  crew_cost: number
  note: string | null
}

/** Full history, newest first. Setter names are visible to admins only (RLS). */
export function listRoutePriceHistory(routeId: string): Promise<RoutePriceWithSetter[]> {
  return unwrapList(
    supabase
      .from('route_prices')
      .select('*, setter:profiles!route_prices_set_by_fkey(full_name)')
      .eq('route_id', routeId)
      .order('effective_from', { ascending: false }) as unknown as PromiseLike<{
      data: RoutePriceWithSetter[] | null
      error: unknown
    }>,
  )
}

/**
 * Close the current price (effective_to = now) and insert the new one in a
 * single database transaction (public.change_route_price).
 */
export function changeRoutePrice(p: NewRoutePrice): Promise<RoutePrice> {
  return unwrap(
    supabase.rpc('change_route_price', {
      p_route_id: p.route_id,
      p_customer_price: p.customer_price,
      p_material_cost: p.material_cost,
      p_diesel_price_per_litre: p.diesel_price_per_litre,
      p_crew_cost: p.crew_cost,
      p_note: p.note ?? undefined,
    }),
  )
}
