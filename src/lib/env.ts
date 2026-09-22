// Required environment variables. Read once at start-up.
export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '',
}

export const missingEnv: string[] = [
  !env.supabaseUrl && 'VITE_SUPABASE_URL',
  !env.supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
].filter((v): v is string => Boolean(v))
