import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env, missingEnv } from './env'

// When env vars are missing the app renders a configuration screen instead of
// calling Supabase, so a placeholder URL here is never contacted.
export const supabase = createClient<Database>(
  missingEnv.length ? 'http://localhost.invalid' : env.supabaseUrl,
  missingEnv.length ? 'missing-anon-key' : env.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export const TRIP_PHOTOS_BUCKET = 'trip-photos'
