import type { RoutePrice } from '@/services/routePrices'

/** Per-trip cost build-up for a route at a given price row. All integer naira. */
export function tripEconomics(price: Pick<RoutePrice, 'customer_price' | 'material_cost' | 'crew_cost' | 'diesel_price_per_litre'>, litres: number) {
  const diesel = Math.round(Number(litres) * price.diesel_price_per_litre)
  const costs = price.material_cost + price.crew_cost + diesel
  return { diesel, costs, margin: price.customer_price - costs }
}
