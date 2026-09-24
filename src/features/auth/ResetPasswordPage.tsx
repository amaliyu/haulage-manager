import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound } from 'lucide-react'
import { Button, Field, Input, SkeletonBlock, useToast } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { updatePassword } from '@/services/auth'
import { AuthLayout } from './AuthLayout'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72, 'Use 72 characters or fewer')
      .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and at least one number'),
    confirm: z.string().min(1, 'Type the password again'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The two passwords do not match' })
type Values = z.infer<typeof schema>

export function ResetPasswordPage() {
  const { state, finishRecovery } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })

  if (state.status === 'loading') {
    return (
      <AuthLayout title="Choose a new password">
        <div className="flex flex-col gap-3">
          <SkeletonBlock className="h-input w-full" />
          <SkeletonBlock className="h-input w-full" />
          <SkeletonBlock className="h-cta w-full" />
        </div>
      </AuthLayout>
    )
  }

  if (state.status === 'ready') return <Navigate to="/" replace />

  if (state.status !== 'recovery') {
    return (
      <AuthLayout title="Link expired" intro="This reset link is no longer valid. Reset links work once and expire after one hour.">
        <Link to="/forgot-password" className="inline-flex min-h-touch items-center text-body font-medium underline underline-offset-4">
          Send a new link
        </Link>
      </AuthLayout>
    )
  }

  const onSubmit = async (v: Values) => {
    try {
      await updatePassword(v.password)
      toast.success('Password changed.')
      finishRecovery()
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err, 'Could not change the password.')
    }
  }

  return (
    <AuthLayout title="Choose a new password" intro={`For ${state.session.user.email ?? 'your account'}.`}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="New password" error={errors.password?.message} hint="At least 8 characters, with a number" required>
          {(p) => (
            <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="password" autoComplete="new-password" {...register('password')} />
          )}
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message} required>
          {(p) => (
            <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="password" autoComplete="new-password" {...register('confirm')} />
          )}
        </Field>
        <Button type="submit" block loading={isSubmitting} icon={<KeyRound size={20} strokeWidth={1.5} aria-hidden />}>
          Save new password
        </Button>
      </form>
    </AuthLayout>
  )
}
