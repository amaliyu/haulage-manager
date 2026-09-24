import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Button, Field, Input, useToast } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { toAppError } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const { state, signIn } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [show, setShow] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  if (state.status === 'ready') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }
  if (state.status === 'signed_out' && state.noAccess) return <Navigate to="/access-not-enabled" replace />

  const onSubmit = async (v: Values) => {
    setFormError(null)
    try {
      await signIn(v.email, v.password)
    } catch (err) {
      const msg = toAppError(err).message
      setFormError(msg)
      toast.error(msg)
    }
  }

  const checking = isSubmitting || (state.status === 'loading')

  return (
    <AuthLayout title="Sign in" intro="Use the email and password your admin set up for you.">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded border border-line border-l-2 border-l-danger bg-surface-2 p-3 text-body text-ink">
            {formError}
          </p>
        )}
        <Field label="Email" error={errors.email?.message} required>
          {(p) => (
            <Input
              id={p.id}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              {...register('email')}
            />
          )}
        </Field>
        <Field label="Password" error={errors.password?.message} required>
          {(p) => (
            <div className="relative">
              <Input
                id={p.id}
                aria-describedby={p.describedBy}
                invalid={p.invalid}
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-12"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-0 top-1/2 flex h-touch w-touch -translate-y-1/2 items-center justify-center text-ink-3 hover:text-ink"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff size={20} strokeWidth={1.5} aria-hidden /> : <Eye size={20} strokeWidth={1.5} aria-hidden />}
              </button>
            </div>
          )}
        </Field>
        <Button type="submit" block loading={checking} icon={<LogIn size={20} strokeWidth={1.5} aria-hidden />}>
          Sign in
        </Button>
        <Link to="/forgot-password" className="inline-flex min-h-touch items-center text-body font-medium underline underline-offset-4">
          Forgot password?
        </Link>
      </form>
    </AuthLayout>
  )
}
