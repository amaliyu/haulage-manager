import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as svc from '@/services/dieselPrices'

export const dieselKeys = { all: ['diesel_prices'] as const }

export function useDieselPrices() {
  return useQuery({ queryKey: dieselKeys.all, queryFn: svc.listDieselPrices })
}

export function useSetDieselPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.setDieselPrice,
    onSuccess: () => qc.invalidateQueries({ queryKey: dieselKeys.all }),
  })
}
