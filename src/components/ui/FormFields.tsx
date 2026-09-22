import type { InputHTMLAttributes, ReactNode } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { Field } from './Field'
import { Input, Select, Textarea } from './Input'

type Base<T extends FieldValues> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<T, any, any>
  name: Path<T>
  label: string
  hint?: string
  required?: boolean
  className?: string
}

function errorOf<T extends FieldValues>(form: Base<T>['form'], name: Path<T>): string | undefined {
  const parts = String(name).split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = form.formState.errors
  for (const p of parts) cur = cur?.[p]
  return typeof cur?.message === 'string' ? cur.message : undefined
}

export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  required,
  className,
  prefix,
  ...input
}: Base<T> & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'form' | 'prefix'> & { prefix?: string }) {
  const error = errorOf(form, name)
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => (
        <Input
          id={p.id}
          aria-describedby={p.describedBy}
          invalid={p.invalid}
          prefix={prefix}
          {...input}
          {...form.register(name)}
        />
      )}
    </Field>
  )
}

/** Whole-naira money input: numeric keyboard, ₦ prefix. */
export function NairaField<T extends FieldValues>(props: Base<T> & { disabled?: boolean }) {
  return <TextField {...props} prefix="₦" inputMode="numeric" autoComplete="off" />
}

export function SelectField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  required,
  className,
  options,
  disabled,
  placeholder,
}: Base<T> & { options: { value: string; label: string }[]; disabled?: boolean; placeholder?: string }) {
  const error = errorOf(form, name)
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => (
        <Select id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} disabled={disabled} {...form.register(name)}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
}

export function TextareaField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  required,
  className,
  rows,
}: Base<T> & { rows?: number }) {
  const error = errorOf(form, name)
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(p) => <Textarea id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} rows={rows} {...form.register(name)} />}
    </Field>
  )
}

export function CheckboxField<T extends FieldValues>({
  form,
  name,
  label,
  description,
}: Base<T> & { description?: ReactNode }) {
  return (
    <label className="flex min-h-touch cursor-pointer items-start gap-3 rounded border border-line bg-panel p-3">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" {...form.register(name)} />
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {description && <span className="text-small text-ink-2">{description}</span>}
      </span>
    </label>
  )
}

/** Stack of fields: single column on phones, optional two columns from md. */
export function FormGrid({ children, cols = 1 }: { children: ReactNode; cols?: 1 | 2 }) {
  return <div className={cols === 2 ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'flex flex-col gap-4'}>{children}</div>
}
