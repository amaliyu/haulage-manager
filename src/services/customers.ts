import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import { ilikeTerm, unwrap, unwrapList, type ActiveFilter } from './_shared'

export type Customer = Tables<'customers'>
export type CustomerInput = Omit<TablesInsert<'customers'>, 'id' | 'created_at' | 'updated_at' | 'created_by'>

export type CustomerFilters = {
  search: string
  type: 'all' | 'company' | 'individual'
  terms: 'all' | 'prepaid' | 'credit'
  active: ActiveFilter
}

export function listCustomers(f: CustomerFilters): Promise<Customer[]> {
  let q = supabase.from('customers').select('*').order('name').limit(500)
  if (f.search.trim()) {
    const t = ilikeTerm(f.search)
    q = q.or(`name.ilike.${t},phone.ilike.${t},alt_phone.ilike.${t}`)
  }
  if (f.type !== 'all') q = q.eq('customer_type', f.type)
  if (f.terms !== 'all') q = q.eq('payment_terms', f.terms)
  if (f.active !== 'all') q = q.eq('is_active', f.active === 'active')
  return unwrapList(q)
}

export function getCustomer(id: string): Promise<Customer> {
  return unwrap(supabase.from('customers').select('*').eq('id', id).single())
}

/** Prepaid customers always carry zero credit (also enforced by a DB check). */
function normalise<T extends Partial<CustomerInput>>(input: T): T {
  if (input.payment_terms === 'prepaid') return { ...input, credit_load_cap: 0, credit_days: 0 }
  return input
}

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return unwrap(supabase.from('customers').insert(normalise(input)).select('*').single())
}

export function updateCustomer(id: string, patch: TablesUpdate<'customers'>): Promise<Customer> {
  return unwrap(supabase.from('customers').update(normalise(patch)).eq('id', id).select('*').single())
}

export function setCustomerActive(id: string, is_active: boolean): Promise<Customer> {
  return updateCustomer(id, { is_active })
}
