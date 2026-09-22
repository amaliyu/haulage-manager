import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as routes from '@/services/routes'
import * as prices from '@/services/routePrices'
import type { ActiveFilter } from '@/services/_shared'
import type { TablesUpdate } from '@/types/database'

export const routeKeys = {
  all: ['routes'] as const,
  list: (f: { search?: string; active?: ActiveFilter }) => ['routes', 'list', f] as const,
  detail: (id: string) => ['routes', 'detail', id] as const,
  history: (id: string) => ['routes', 'history', id] as const,
}

export function useRoutes(f: { search?: string; active?: ActiveFilter } = {}) {
  return useQuery({ queryKey: routeKeys.list(f), queryFn: () => routes.listRoutes(f), placeholderData: keepPreviousData })
}

export function useRoute(id: string | undefined) {
  return useQuery({ queryKey: routeKeys.detail(id ?? ''), queryFn: () => routes.getRoute(id!), enabled: Boolean(id) })
}

export function useRoutePriceHistory(id: string) {
  return useQuery({ queryKey: routeKeys.history(id), queryFn: () => prices.listRoutePriceHistory(id) })
}

export type InitialPrice = Omit<prices.NewRoutePrice, 'route_id'>

export function useSaveRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id?: string; input: routes.RouteInput | TablesUpdate<'routes'>; initialPrice?: InitialPrice }) => {
      if (v.id) return { route: await routes.updateRoute(v.id, v.input), priceError: null }
      const route = await routes.createRoute(v.input as routes.RouteInput)
      let priceError: unknown = null
      if (v.initialPrice) {
        try {
          await prices.changeRoutePrice({ ...v.initialPrice, route_id: route.id })
        } catch (err) {
          priceError = err
        }
      }
      return { route, priceError }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: routeKeys.all }),
  })
}

export function useChangeRoutePrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: prices.changeRoutePrice,
    onSuccess: () => qc.invalidateQueries({ queryKey: routeKeys.all }),
  })
}
