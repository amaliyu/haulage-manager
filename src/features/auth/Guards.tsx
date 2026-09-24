import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, useProfile } from '@/hooks/useAuth'
import type { Role } from '@/services/profiles'
import { ErrorState, SkeletonBlock } from '@/components/ui'
import { AuthLayout } from './AuthLayout'

function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-surface" aria-busy="true" aria-label="Loading">
      <div className="h-header border-b border-line bg-panel" />
      <div className="mx-auto flex max-w-content flex-col gap-3 px-4 py-6 sm:px-6">
        <SkeletonBlock className="h-8 w-1/2" />
        <SkeletonBlock className="h-row w-full" />
        <SkeletonBlock className="h-row w-full" />
        <SkeletonBlock className="h-row w-full" />
      </div>
    </div>
  )
}

export function RequireAuth() {
  const { state, retry } = useAuth()
  const location = useLocation()
  if (state.status === 'loading') return <ShellSkeleton />
  if (state.status === 'error') {
    return (
      <AuthLayout title="Could not start">
        <ErrorState what="Could not load your account." error={{ message: state.message }} onRetry={retry} />
      </AuthLayout>
    )
  }
  if (state.status === 'recovery') return <Navigate to="/reset-password" replace />
  if (state.status === 'signed_out') {
    if (state.noAccess) return <Navigate to="/access-not-enabled" replace />
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

/** Hide a route from roles that cannot use it. RLS is still the real guard. */
export function RequireRole({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const profile = useProfile()
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />
  return children ? <>{children}</> : <Outlet />
}
