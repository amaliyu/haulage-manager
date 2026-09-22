import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { unwrap, unwrapList } from './_shared'

export type Profile = Tables<'profiles'>
export type Role = 'admin' | 'dispatcher' | 'finance' | 'driver'
export const ROLES: Role[] = ['admin', 'dispatcher', 'finance', 'driver']

/** The signed-in user's own profile, or null when no row exists. */
export async function getOwnProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export function listProfiles(): Promise<Profile[]> {
  return unwrapList(supabase.from('profiles').select('*').order('full_name'))
}

export function updateProfile(id: string, patch: { role?: Role; is_active?: boolean; full_name?: string; phone?: string | null }) {
  return unwrap(supabase.from('profiles').update(patch).eq('id', id).select('*').single())
}

/** Give an existing auth user access by creating their profile row (admin only). */
export function createProfile(input: { id: string; full_name: string; phone: string | null; role: Role }) {
  return unwrap(supabase.from('profiles').insert(input).select('*').single())
}
