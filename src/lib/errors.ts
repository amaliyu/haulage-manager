// Turn Supabase / Postgres errors into one plain sentence for the user.

type MaybePgError = { message?: string; code?: string; details?: string; hint?: string }

export class AppError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

export function toAppError(err: unknown, fallback = 'Something went wrong. Try again.'): AppError {
  if (err instanceof AppError) return err
  const e = (err ?? {}) as MaybePgError
  const msg = e.message ?? ''
  switch (e.code) {
    case '23505':
      return new AppError(duplicateMessage(e), e.code)
    case '23503':
      return new AppError('This record is linked to other records and cannot be changed that way.', e.code)
    case '23514':
      return new AppError(checkMessage(msg), e.code)
    case '42501':
      // Our guard triggers raise 42501 with a readable sentence.
      if (msg && !msg.startsWith('new row violates') && !msg.startsWith('permission denied')) {
        return new AppError(msg, e.code)
      }
      return new AppError('You do not have permission to do that.', e.code)
    case 'P0001':
    case 'P0002':
      return new AppError(msg || fallback, e.code)
    case 'PGRST116':
      return new AppError('Record not found, or you do not have access to it.', e.code)
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return new AppError('No connection to the server. Check your data or Wi-Fi and try again.', 'network')
  }
  if (msg.includes('Invalid login credentials')) return new AppError('Email or password is wrong.', 'auth')
  if (msg.includes('Email not confirmed')) return new AppError('Confirm your email address first, using the link we sent you.', 'auth')
  return new AppError(msg || fallback, e.code)
}

function duplicateMessage(e: MaybePgError) {
  const d = `${e.message ?? ''} ${e.details ?? ''}`
  if (d.includes('plate_number')) return 'A truck with this plate number already exists.'
  if (d.includes('routes_source_id_destination_area')) return 'A route from this source to this destination already exists.'
  if (d.includes('drivers_profile_id')) return 'That user is already linked to another driver.'
  if (d.includes('one_open')) return 'Someone else changed this price at the same time. Reload and try again.'
  return 'This record already exists.'
}

function checkMessage(msg: string) {
  if (msg.includes('customers_prepaid_has_no_credit')) return 'Prepaid customers cannot have a credit cap or credit days.'
  return 'One of the values is not allowed. Check the form and try again.'
}
