// Display formatters. Money is integer naira; timestamps are UTC ISO strings
// from Postgres timestamptz, displayed in Africa/Lagos time.

export const LAGOS_TZ = 'Africa/Lagos'

const nairaFmt = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0, minimumFractionDigits: 0 })
const numberFmt = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 })

/** ₦1,234,567 — no decimals. Negative values render as −₦1,234. */
export function formatNaira(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—'
  const rounded = Math.round(amount)
  const body = nairaFmt.format(Math.abs(rounded))
  return rounded < 0 ? `−₦${body}` : `₦${body}`
}

/** Plain quantity with thousands separators, e.g. 1,234.5 */
export function formatNumber(value: number | null | undefined, unit?: string): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const s = numberFmt.format(Number(value))
  return unit ? `${s} ${unit}` : s
}

const dateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: LAGOS_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

function parts(iso: string) {
  const out: Record<string, string> = {}
  for (const p of dateParts.formatToParts(new Date(iso))) out[p.type] = p.value
  return out
}

function currentLagosYear(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: LAGOS_TZ, year: 'numeric' }).format(new Date())
}

/** "22 Sep, 4:30pm" in Africa/Lagos; the year is added when not the current year. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const p = parts(iso)
  const year = p.year !== currentLagosYear() ? ` ${p.year}` : ''
  const ampm = (p.dayPeriod ?? '').toLowerCase().replace(/\s|\./g, '')
  return `${p.day} ${p.month}${year}, ${p.hour}:${p.minute}${ampm}`
}

/** "22 Sep 2026" in Africa/Lagos. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const p = parts(iso)
  return `${p.day} ${p.month} ${p.year}`
}

export function titleCase(value: string): string {
  return value
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}
