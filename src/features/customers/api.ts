import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as customers from '@/services/customers'
import * as sites from '@/services/customerSites'
import type { TablesUpdate } from '@/types/database'

export const customerKeys = {
  all: ['customers'] as const,
  list: (f: customers.CustomerFilters) => ['customers', 'list', f] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
  sites: (id: string) => ['customers', 'sites', id] as const,
}

export function useCustomers(f: customers.CustomerFilters) {
  return useQuery({ queryKey: customerKeys.list(f), queryFn: () => customers.listCustomers(f), placeholderData: keepPreviousData })
}

export function useCustomer(id: string | undefined) {
  return useQuery({ queryKey: customerKeys.detail(id ?? ''), queryFn: () => customers.getCustomer(id!), enabled: Boolean(id) })
}

export function useSaveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id?: string; input: customers.CustomerInput }) =>
      v.id ? customers.updateCustomer(v.id, v.input) : customers.createCustomer(v.input),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: customerKeys.all })
      qc.setQueryData(customerKeys.detail(row.id), row)
    },
  })
}

export function useSetCustomerActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; active: boolean }) => customers.setCustomerActive(v.id, v.active),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useSites(customerId: string) {
  return useQuery({ queryKey: customerKeys.sites(customerId), queryFn: () => sites.listSitesForCustomer(customerId) })
}

export function useSaveSite(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id?: string; input: sites.CustomerSiteInput | TablesUpdate<'customer_sites'> }) =>
      v.id ? sites.updateSite(v.id, v.input) : sites.createSite(v.input as sites.CustomerSiteInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.sites(customerId) }),
  })
}
