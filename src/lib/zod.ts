import { z } from 'zod'

// Form fields arrive as strings; these helpers coerce and validate them.

const trimmed = z.string().trim()

export const requiredText = (label: string, max = 120) =>
  trimmed.min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`)

export const optionalText = (max = 500) =>
  trimmed.max(max, `Must be ${max} characters or fewer`).transform((v) => (v === '' ? null : v))

/** Nigerian phone: 0803 123 4567, +234 803 123 4567, etc. */
const phoneRe = /^(\+?234|0)[789][01]\d{8}$/
export const phone = (label = 'Phone') =>
  trimmed
    .min(1, `${label} is required`)
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => phoneRe.test(v), `${label} must be a Nigerian number, e.g. 0803 123 4567`)

export const optionalPhone = (label = 'Phone') =>
  trimmed
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => v === '' || phoneRe.test(v), `${label} must be a Nigerian number, e.g. 0803 123 4567`)
    .transform((v) => (v === '' ? null : v))

function toNumber(v: unknown) {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return Number.NaN
  const cleaned = v.replace(/[,\s₦]/g, '')
  return cleaned === '' ? Number.NaN : Number(cleaned)
}

/** Whole naira, stored as int. Accepts "310,000" and "₦310000". */
export const naira = (label: string, { min = 0, allowZero = true } = {}) =>
  z
    .union([z.string(), z.number()])
    .transform(toNumber)
    .refine((n) => !Number.isNaN(n), `${label} is required`)
    .refine((n) => Number.isInteger(n), `${label} must be whole naira, no kobo`)
    .refine((n) => (allowZero ? n >= min : n > min), allowZero ? `${label} cannot be negative` : `${label} must be more than ₦${min}`)
    .refine((n) => n <= 2_000_000_000, `${label} is too large`)

export const wholeNumber = (label: string, { min = 0, max = 1_000_000 } = {}) =>
  z
    .union([z.string(), z.number()])
    .transform(toNumber)
    .refine((n) => !Number.isNaN(n), `${label} is required`)
    .refine((n) => Number.isInteger(n), `${label} must be a whole number`)
    .refine((n) => n >= min, `${label} must be at least ${min}`)
    .refine((n) => n <= max, `${label} must be at most ${max.toLocaleString('en-NG')}`)

/** numeric(p,2) values such as litres, km, tonnes. */
export const decimal = (label: string, { min = 0, max = 9999.99, required = true } = {}) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (v === '' || v === null ? null : toNumber(v)))
    .refine((n) => !required || n !== null, `${label} is required`)
    .refine((n) => n === null || !Number.isNaN(n), `${label} must be a number`)
    .refine((n) => n === null || n >= min, `${label} must be at least ${min}`)
    .refine((n) => n === null || n <= max, `${label} must be at most ${max}`)
    .refine((n) => n === null || Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, `${label} allows at most 2 decimal places`)

export const latitude = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((n) => n === null || (!Number.isNaN(n) && n >= -90 && n <= 90), 'Latitude must be between -90 and 90')

export const longitude = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((n) => n === null || (!Number.isNaN(n) && n >= -180 && n <= 180), 'Longitude must be between -180 and 180')

/** Round coordinates to the column's numeric(9,6) precision. */
export const roundCoord = (n: number) => Math.round(n * 1e6) / 1e6
