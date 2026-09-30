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
 * A typed material or crew cost larger than the whole customer price is almost
 * certainly a typing mistake (an extra zero), so the forms refuse it outright.
 * Diesel is not checked here: it follows the pump price, so diesel above the
 * customer price can be real and goes through the loss confirmation instead.
 * Returns the field to flag, or null.
 */
export function costOverPrice(price: PriceInput): { field: 'material_cost' | 'crew_cost'; message: string } | null {
  const limit = formatNaira(price.customer_price)
  if (price.material_cost > price.customer_price)
    return { field: 'material_cost', message: `Material cost is more than the customer price (${limit}). Check for an extra zero.` }
  if (price.crew_cost > price.customer_price)
    return { field: 'crew_cost', message: `Crew cost is more than the customer price (${limit}). Check for an extra zero.` }
  return null
}
