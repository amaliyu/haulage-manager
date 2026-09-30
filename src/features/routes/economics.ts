import type { RoutePrice } from '@/services/routePrices'
import { formatNaira } from '@/lib/format'

type PriceInput = Pick<RoutePrice, 'customer_price' | 'material_cost' | 'crew_cost' | 'diesel_price_per_litre'>

/** Per-trip cost build-up for a route at a given price row. All integer naira. */
export function tripEconomics(price: PriceInput, litres: number) {
  const diesel = Math.round(Number(litres) * price.diesel_price_per_litre)
  const costs = price.material_cost + price.crew_cost + diesel
  return { diesel, costs, margin: price.customer_price - costs }
}

/**
 * A single cost larger than the whole customer price is almost certainly a
 * typing mistake (an extra zero), so the forms refuse it outright. Returns the
 * field to flag, or null.
 */
export function costOverPrice(price: PriceInput, litres: number): { field: keyof PriceInput; message: string } | null {
  const { diesel } = tripEconomics(price, litres)
  const limit = formatNaira(price.customer_price)
  if (price.material_cost > price.customer_price)
    return { field: 'material_cost', message: `Material cost is more than the customer price (${limit}). Check for an extra zero.` }
  if (price.crew_cost > price.customer_price)
    return { field: 'crew_cost', message: `Crew cost is more than the customer price (${limit}). Check for an extra zero.` }
  if (diesel > price.customer_price)
    return { field: 'diesel_price_per_litre', message: `Diesel for this route (${formatNaira(diesel)}) is more than the customer price (${limit}).` }
  return null
}
