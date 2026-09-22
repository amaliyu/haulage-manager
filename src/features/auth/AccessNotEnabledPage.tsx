import { Navigate, useNavigate } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { AuthLayout } from './AuthLayout'

export function AccessNotEnabledPage() {
  const { state, clearNoAccess } = useAuth()
  const navigate = useNavigate()

  if (state.status === 'ready') return <Navigate to="/" replace />
  const reason = state.status === 'signed_out' ? state.noAccess : undefined

  return (
    <AuthLayout title="Access not enabled">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <ShieldOff size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-danger" aria-hidden />
          <div className="flex flex-col gap-2 text-body">
            <p className="font-semibold">
              {reason === 'inactive'
                ? 'Your account has been deactivated.'
                : 'Your sign-in worked, but no one has given this account access yet.'}
            </p>
            <p className="text-ink-2">
              Ask an admin to {reason === 'inactive' ? 'reactivate your account' : 'add you as a user and choose your role'}.
              You have been signed out.
            </p>
          </div>
        </div>
        <Button
          block
          variant="secondary"
          onClick={() => {
            clearNoAccess()
            navigate('/login', { replace: true })
          }}
        >
          Back to sign in
        </Button>
      </div>
    </AuthLayout>
  )
}
