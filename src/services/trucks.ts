import { supabase, TRIP_PHOTOS_BUCKET } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import { ilikeTerm, unwrap, unwrapList, type ActiveFilter } from './_shared'

export type Truck = Tables<'trucks'>
export type TruckInput = Omit<TablesInsert<'trucks'>, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type OwnerType = 'spv' | 'operator' | 'partner'
export type TruckStatus = 'available' | 'on_trip' | 'maintenance' | 'inactive'
export const OWNER_TYPES: OwnerType[] = ['spv', 'operator', 'partner']
export const TRUCK_STATUSES: TruckStatus[] = ['available', 'on_trip', 'maintenance', 'inactive']

export type TruckFilters = { search?: string; owner?: 'all' | OwnerType; active?: ActiveFilter }

export function listTrucks(f: TruckFilters = {}): Promise<Truck[]> {
  let q = supabase.from('trucks').select('*').order('plate_number')
  if (f.search?.trim()) {
    const t = ilikeTerm(f.search)
    q = q.or(`plate_number.ilike.${t},make.ilike.${t},model.ilike.${t},owner_name.ilike.${t}`)
  }
  if (f.owner && f.owner !== 'all') q = q.eq('owner_type', f.owner)
  if (f.active && f.active !== 'all') q = q.eq('is_active', f.active === 'active')
  return unwrapList(q)
}

export function getTruck(id: string): Promise<Truck> {
  return unwrap(supabase.from('trucks').select('*').eq('id', id).single())
}

export function createTruck(input: TruckInput): Promise<Truck> {
  return unwrap(supabase.from('trucks').insert(input).select('*').single())
}

export function updateTruck(id: string, patch: TablesUpdate<'trucks'>): Promise<Truck> {
  return unwrap(supabase.from('trucks').update(patch).eq('id', id).select('*').single())
}

export function truckReferencePath(truckId: string) {
  return `trucks/${truckId}/reference.jpg`
}

/** Upload (or replace) the reference "full load" photo and record its path. */
export async function uploadTruckReferencePhoto(truckId: string, jpeg: Blob): Promise<Truck> {
  const path = truckReferencePath(truckId)
  const { error } = await supabase.storage.from(TRIP_PHOTOS_BUCKET).upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '60',
  })
  if (error) throw toAppError(error, 'Could not upload the photo.')
  return updateTruck(truckId, { reference_load_photo_url: path })
}

/** Short-lived signed URL for a private photo. */
export async function getPhotoUrl(path: string, expiresInSeconds = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(TRIP_PHOTOS_BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error) throw toAppError(error, 'Could not load the photo.')
  return data.signedUrl
}
