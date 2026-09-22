import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { unwrap, unwrapList } from './_shared'

export type DieselPrice = Tables<'diesel_prices'>
export type DieselPriceWithSetter = DieselPrice & { setter: { full_name: string } | null }

export function listDieselPrices(): Promise<DieselPriceWithSetter[]> {
  return unwrapList(
    supabase
      .from('diesel_prices')
      .select('*, setter:profiles!diesel_prices_set_by_fkey(full_name)')
      .order('effective_from', { ascending: false })
      .limit(200) as unknown as PromiseLike<{ data: DieselPriceWithSetter[] | null; error: unknown }>,
  )
}

/** Close the current pump price and record the new one in one transaction. */
export function setDieselPrice(pricePerLitre: number): Promise<DieselPrice> {
  return unwrap(supabase.rpc('set_diesel_price', { p_price_per_litre: pricePerLitre }))
}
