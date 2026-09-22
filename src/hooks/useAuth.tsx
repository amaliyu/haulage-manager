import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import * as authService from '@/services/auth'
import { getOwnProfile, type Profile, type Role } from '@/services/profiles'
import { toAppError } from '@/lib/errors'

export type NoAccessReason = 'no_profile' | 'inactive'

type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out'; noAccess?: NoAccessReason }
  | { status: 'recovery'; session: Session }
  | { status: 'error'; message: string }
  | { status: 'ready'; session: Session; profile: Profile & { role: Role } }

type AuthApi = {
  state: AuthState
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  retry: () => void
  clearNoAccess: () => void
  finishRecovery: () => void
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const recovering = useRef(window.location.pathname === '/reset-password')

  const resolve = useCallback(async (session: Session | null) => {
    if (!session) {
      setState((s) => (s.status === 'signed_out' ? s : { status: 'signed_out' }))
      return
    }
    if (recovering.current) {
      setState({ status: 'recovery', session })
      return
    }
    try {
      const profile = await getOwnProfile(session.user.id)
      if (!profile || !profile.is_active) {
        const reason: NoAccessReason = profile ? 'inactive' : 'no_profile'
        await authService.signOut().catch(() => undefined)
        setState({ status: 'signed_out', noAccess: reason })
        return
      }
      setState({ status: 'ready', session, profile: profile as Profile & { role: Role } })
    } catch (err) {
      setState({ status: 'error', message: toAppError(err, 'Could not load your profile.').message })
    }
  }, [])

  const load = useCallback(() => {
    setState({ status: 'loading' })
    authService
      .getSession()
      .then(resolve)
      .catch((err) => setState({ status: 'error', message: toAppError(err).message }))
  }, [resolve])

  useEffect(() => {
    load()
    return authService.onAuthChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recovering.current = true
        if (session) setState({ status: 'recovery', session })
        return
      }
      if (event === 'SIGNED_OUT') {
        setState((s) => (s.status === 'signed_out' ? s : { status: 'signed_out' }))
        return
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Defer: calling Supabase inside the auth callback can deadlock.
        window.setTimeout(() => void resolve(session), 0)
      }
    })
  }, [load, resolve])

  const api = useMemo<AuthApi>(
    () => ({
      state,
      signIn: async (email, password) => {
        await authService.signIn(email, password)
        // The SIGNED_IN event resolves the profile next.
        setState({ status: 'loading' })
      },
      signOut: async () => {
        await authService.signOut().catch(() => undefined)
        setState({ status: 'signed_out' })
      },
      retry: load,
      clearNoAccess: () => setState({ status: 'signed_out' }),
      finishRecovery: () => {
        recovering.current = false
        load()
      },
    }),
    [state, load],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** The signed-in profile. Only call inside routes guarded by RequireAuth. */
export function useProfile(): Profile & { role: Role } {
  const { state } = useAuth()
  if (state.status !== 'ready') throw new Error('useProfile used outside an authenticated route')
  return state.profile
}
