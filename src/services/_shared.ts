import { toAppError } from '@/lib/errors'

type Result<T> = { data: T; error: unknown }

/** Throw a readable AppError when Supabase returns an error. */
export async function unwrap<T>(query: PromiseLike<Result<T>>): Promise<NonNullable<T>> {
  const { data, error } = await query
  if (error) throw toAppError(error)
  if (data === null || data === undefined) throw toAppError({ code: 'PGRST116' })
  return data as NonNullable<T>
}

export async function unwrapList<T>(query: PromiseLike<Result<T[] | null>>): Promise<T[]> {
  const { data, error } = await query
  if (error) throw toAppError(error)
  return data ?? []
}

/** Escape user input for a PostgREST ilike filter inside .or(). */
export function ilikeTerm(q: string): string {
  const cleaned = q.trim().replace(/[%_\\,()*"]/g, ' ').replace(/\s+/g, ' ')
  return `*${cleaned}*`
}

export type ActiveFilter = 'active' | 'inactive' | 'all'
