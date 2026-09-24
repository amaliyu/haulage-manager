import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import { unwrap, unwrapList } from './_shared'

export type CustomerSite = Tables<'customer_sites'>
export type CustomerSiteInput = Omit<TablesInsert<'customer_sites'>, 'id' | 'created_at' | 'updated_at' | 'created_by'>

export function listSitesForCustomer(customerId: string): Promise<CustomerSite[]> {
  return unwrapList(
    supabase
      .from('customer_sites')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_active', { ascending: false })
      .order('name'),
  )
}

export function createSite(input: CustomerSiteInput): Promise<CustomerSite> {
  return unwrap(supabase.from('customer_sites').insert(input).select('*').single())
}

export function updateSite(id: string, patch: TablesUpdate<'customer_sites'>): Promise<CustomerSite> {
  return unwrap(supabase.from('customer_sites').update(patch).eq('id', id).select('*').single())
}
