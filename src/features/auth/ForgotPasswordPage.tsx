import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail } from 'lucide-react'
import { Button, Field, Input, useToast } from '@/components/ui'
import { sendPasswordReset } from '@/services/auth'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
})
type Values = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const toast = useToast()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = async (v: Values) => {
    try {
      await sendPasswordReset(v.email)
      setSentTo(v.email)
      toast.success('Reset link sent.')
    } catch (err) {
      toast.error(err, 'Could not send the reset link.')
    }
  }

  return (
    <AuthLayout title="Reset password" intro="We will email you a link to choose a new password.">
      {sentTo ? (
        <div className="flex flex-col gap-4">
          <p className="text-body">
            If <strong className="break-all">{sentTo}</strong> has an account, a reset link is on its way. Open it on this
            phone. It expires after one hour.
          </p>
          <Link to="/login" className="inline-flex min-h-touch items-center text-body font-medium underline underline-offset-4">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Email" error={errors.email?.message} required>
            {(p) => (
              <Input
                id={p.id}
                aria-describedby={p.describedBy}
                invalid={p.invalid}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                {...register('email')}
              />
            )}
          </Field>
          <Button type="submit" block loading={isSubmitting} icon={<Mail size={20} strokeWidth={1.5} aria-hidden />}>
            Send reset link
          </Button>
          <Link to="/login" className="inline-flex min-h-touch items-center text-body font-medium underline underline-offset-4">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
